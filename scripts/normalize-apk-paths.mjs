import { readFileSync, writeFileSync } from 'node:fs';

// Windows AAPT2 can emit backslashes in nested asset names. Replace only names,
// in both ZIP headers, before alignment/signing; compressed bytes stay untouched.
export function normalizeApkPaths(filename) {
  const bytes = readFileSync(filename);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error('Missing APK ZIP directory');
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw new Error('Unsupported multipart APK');
  const count = bytes.readUInt16LE(end + 10);
  let central = bytes.readUInt32LE(end + 16);
  let changed = 0;
  for (let index = 0; index < count; index++) {
    if (bytes.readUInt32LE(central) !== 0x02014b50) throw new Error('Invalid APK ZIP directory');
    const length = bytes.readUInt16LE(central + 28);
    const extra = bytes.readUInt16LE(central + 30), comment = bytes.readUInt16LE(central + 32);
    const local = bytes.readUInt32LE(central + 42);
    if (bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 26) !== length) throw new Error('Invalid APK local header');
    const name = bytes.subarray(central + 46, central + 46 + length);
    const localName = bytes.subarray(local + 30, local + 30 + length);
    if (!name.equals(localName)) throw new Error('APK entry headers disagree');
    if (name.includes(0x5c)) {
      for (let char = 0; char < length; char++) if (name[char] === 0x5c) { name[char] = 0x2f; localName[char] = 0x2f; }
      changed++;
    }
    central += 46 + length + extra + comment;
  }
  if (changed) writeFileSync(filename, bytes);
  console.log(`Normalized ${changed} APK asset paths before signing.`);
}
