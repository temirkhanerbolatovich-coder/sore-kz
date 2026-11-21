const MAX_REPORT_BYTES = 4 * 1024;

export async function readReportBody(request: Request): Promise<
  { status: 200; data: unknown } | { status: 400 | 413 }
> {
  if (Number(request.headers.get("content-length")) > MAX_REPORT_BYTES) return { status: 413 };
  if (!request.body) return { status: 400 };

  const reader = request.body.getReader();
  const buffer = new Uint8Array(MAX_REPORT_BYTES);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > buffer.length) {
        await reader.cancel().catch(() => undefined);
        return { status: 413 };
      }
      buffer.set(value, size);
      size += value.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
    return { status: 200, data: JSON.parse(text) };
  } catch {
    return { status: 400 };
  } finally {
    reader.releaseLock();
  }
}
