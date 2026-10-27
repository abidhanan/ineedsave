import { writeFileSync } from 'node:fs';

const RETRYABLE = new Set(['EACCES', 'EBUSY', 'EPERM', 'UNKNOWN']);
const waitBuffer = new Int32Array(new SharedArrayBuffer(4));

export function writeTextFile(path, contents) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      writeFileSync(path, contents);
      return;
    } catch (error) {
      if (!RETRYABLE.has(error.code) || attempt >= 7) throw error;
      Atomics.wait(waitBuffer, 0, 0, 25 * (attempt + 1));
    }
  }
}
