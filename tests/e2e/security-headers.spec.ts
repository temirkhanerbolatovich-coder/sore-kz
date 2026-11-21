import { expect, test } from "@playwright/test";

test("защитные заголовки есть на лендинге и на редиректе из кабинета", async ({ request }) => {
  for (const path of ["/", "/dashboard"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(path === "/" ? 200 : 307);
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    if (path === "/dashboard") expect(headers.location).toMatch(/\/login$/);
  }
});
