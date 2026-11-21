import { inflateRawSync } from "node:zlib";

/**
 * Защита от «zip-бомбы» для .xlsx (это zip-архив). Заявленным в заголовках размерам доверять нельзя,
 * поэтому каждая запись реально распаковывается с жёстким потолком `maxOutputLength`: бомба обрывается
 * на лимите, а не заполняет память. Вызывается ДО передачи файла парсеру xlsx.
 * Zip64, шифрование и экзотические методы сжатия отклоняются: настоящий Excel их не использует для прайса.
 */

export const MAX_ENTRIES = 200;
export const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

export class UnsafeZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeZipError";
  }
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export function assertSafeZip(buf: Buffer): void {
  if (buf.length < 22) throw new UnsafeZipError("не архив");
  // Конец центрального каталога: ищем с хвоста (после него может быть комментарий до 65 535 байт).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65_535); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new UnsafeZipError("не архив");
  const count = buf.readUInt16LE(eocd + 10);
  const dirSize = buf.readUInt32LE(eocd + 12);
  const dirOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) throw new UnsafeZipError("zip64 не поддерживается");
  if (count === 0 || count > MAX_ENTRIES) throw new UnsafeZipError("слишком много файлов внутри");
  if (dirOffset + dirSize > buf.length) throw new UnsafeZipError("повреждённый архив");

  let pos = dirOffset;
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== CENTRAL) throw new UnsafeZipError("повреждённый архив");
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    pos += 46 + nameLen + extraLen + commentLen;

    if (flags & 1) throw new UnsafeZipError("архив зашифрован");
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new UnsafeZipError("zip64 не поддерживается");
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOCAL) throw new UnsafeZipError("повреждённый архив");
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    if (start + compressedSize > buf.length) throw new UnsafeZipError("повреждённый архив");
    const data = buf.subarray(start, start + compressedSize);

    let size: number;
    if (method === 0) size = data.length;
    else if (method === 8) {
      try {
        size = inflateRawSync(data, { maxOutputLength: Math.min(MAX_ENTRY_BYTES, MAX_TOTAL_BYTES - total) }).length;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        throw new UnsafeZipError(code === "ERR_BUFFER_TOO_LARGE" ? "файл слишком большой после распаковки" : "повреждённый архив");
      }
    } else throw new UnsafeZipError("неподдерживаемый способ сжатия");
    total += size;
    if (size > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) throw new UnsafeZipError("файл слишком большой после распаковки");
  }
}
