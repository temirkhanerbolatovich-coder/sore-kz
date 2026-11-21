import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";
import { POST as postClientError } from "@/app/api/report-error/route";
import { reportError } from "@/lib/monitoring";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/monitoring", () => ({ reportError: vi.fn(async () => true) }));
const reportErrorMock = vi.mocked(reportError);

beforeEach(() => {
  const buckets = new Map<string, { start: number; hits: number }>();
  rpc.mockImplementation(async (_method: string, { p_key, p_seconds, p_limit }) => {
    const now = Date.now();
    let bucket = buckets.get(p_key);
    if (!bucket || now - bucket.start > p_seconds * 1000) {
      bucket = { start: now, hits: 0 };
      buckets.set(p_key, bucket);
    }
    return { data: ++bucket.hits <= p_limit, error: null };
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

function request(blocked: string, sourceFile = "", forwardedFor = "192.0.2.54") {
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "x-forwarded-for": forwardedFor },
    body: JSON.stringify({ "csp-report": {
      "effective-directive": "connect-src",
      "blocked-uri": blocked,
      "source-file": sourceFile,
      "document-uri": "http://localhost/o/test-code?private=test-value",
    } }),
  });
}

test("расширения браузера отбрасываются", async () => {
  for (const scheme of ["chrome-extension", "moz-extension", "safari-extension"]) {
    expect((await POST(request(`${scheme}://extension-id`))).status).toBe(204);
  }
  expect((await POST(request("inline", "chrome-extension://extension-id/script.js"))).status).toBe(204);
  expect(reportErrorMock).not.toHaveBeenCalled();
});

test("нарушение без приватных частей URL пересылается раз в минуту", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = Date.now();
  const blocked = "https://unknown.example/private-path?private=test-value";
  expect((await POST(request(blocked))).status).toBe(204);
  expect((await POST(request(blocked))).status).toBe(204);
  expect(reportErrorMock).toHaveBeenCalledExactlyOnceWith("client", "CSP connect-src: https://unknown.example", "http://localhost");
  vi.setSystemTime(now + 60_001);
  expect((await POST(request(blocked))).status).toBe(204);
  expect(reportErrorMock).toHaveBeenCalledTimes(2);
});

test("отчёт больше 4 КБ отклоняется даже без content-length", async () => {
  expect((await POST(request("https://large.example/" + "а".repeat(2048)))).status).toBe(413);
  expect(reportErrorMock).not.toHaveBeenCalled();
});

test("невалидный JSON отклоняется", async () => {
  const invalid = new Request("http://localhost/api/csp-report", { method: "POST", body: "{[(" });
  expect((await POST(invalid)).status).toBe(400);
  expect(reportErrorMock).not.toHaveBeenCalled();
});

function clientError(message: string, forwardedFor = "192.0.2.54") {
  return new Request("http://localhost/api/report-error", {
    method: "POST",
    headers: { "x-forwarded-for": forwardedFor },
    body: JSON.stringify({ message, path: "/demo", digest: "test-digest" }),
  });
}

test("два маршрута делят пять запросов в минуту по хэшу первого IP", async () => {
  for (let index = 0; index < 4; index++) {
    expect((await postClientError(clientError(`Сбой ${index}`))).status).toBe(200);
  }
  expect((await POST(request("https://another.example", "", "192.0.2.54, 10.0.0.1"))).status).toBe(204);
  expect((await postClientError(clientError("Ещё один сбой", "192.0.2.54, 10.0.0.2"))).status).toBe(429);
  expect((await POST(request("inline"))).status).toBe(429);
  expect(reportErrorMock).toHaveBeenCalledTimes(5);
  expect((await postClientError(clientError("Отдельный IP", "192.0.2.55"))).status).toBe(200);
  const first = rpc.mock.calls[0];
  expect(first).toEqual([
    "rate_limit_hit",
    { p_key: expect.stringMatching(/^error-reports:[0-9a-f]{64}$/), p_seconds: 60, p_limit: 5 },
  ]);
});

test("отчёт об ошибке больше 4 КБ отклоняется до обращения к БД", async () => {
  expect((await postClientError(clientError("а".repeat(2048)))).status).toBe(413);
  expect(rpc).not.toHaveBeenCalled();
  expect(reportErrorMock).not.toHaveBeenCalled();
});

test("сбой БД не даёт обойти лимит", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { code: "unavailable" } });
  expect((await postClientError(clientError("Проверка сбоя"))).status).toBe(503);
  expect(reportErrorMock).not.toHaveBeenCalled();
});
