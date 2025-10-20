// Generate a simple, readable folio: HMD-YYYYMMDD-XXXX
// XXXX is a short base36 code derived from a CRC32 of the receipt id
export function generateSimpleFolio(id: string, createdAt: Date): string {
  const d = createdAt instanceof Date ? createdAt : new Date(createdAt as any);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyymmdd = `${y}${mm}${dd}`;
  const code = toBase36(crc32(id)).toUpperCase().slice(0, 6);
  return `HMD-${yyyymmdd}-${code}`;
}

function toBase36(n: number): string {
  // Convert unsigned int to base36
  let x = n >>> 0;
  if (x === 0) return '0';
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let out = '';
  while (x > 0) {
    out = chars[x % 36] + out;
    x = Math.floor(x / 36);
  }
  return out;
}

// Fast CRC32 (IEEE 802.3) over UTF-8 string
function crc32(str: string): number {
  const table = crc32Table;
  let crc = 0 ^ -1;
  const utf8 = new TextEncoder().encode(str);
  for (let i = 0; i < utf8.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ utf8[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Precomputed CRC32 table
const crc32Table = (() => {
  const tbl = new Array<number>(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    tbl[i] = c >>> 0;
  }
  return tbl;
})();

