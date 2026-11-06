/**
 * Generator QR Code mandiri (Pure JavaScript, 100% offline, tanpa dependency eksternal).
 * Menghasilkan matriks modul atau SVG string untuk render QR Code di browser.
 */

// Galois Field (256) untuk Reed-Solomon Error Correction
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(p, q) {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return r;
}

function rsGenPoly(n) {
  let g = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    g = polyMul(g, new Uint8Array([1, GF256_EXP[i]]));
  }
  return g;
}

function rsEncode(data, ecCount) {
  const gen = rsGenPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Kapasitas & parameter versi QR (Versi 1-10, Error Correction M)
const QR_SPECS = [
  null,
  { version: 1, size: 21, dataCodewords: 16, ecCodewords: 10, ecBlocks: 1, alignments: [] },
  { version: 2, size: 25, dataCodewords: 28, ecCodewords: 16, ecBlocks: 1, alignments: [6, 18] },
  { version: 3, size: 29, dataCodewords: 44, ecCodewords: 26, ecBlocks: 1, alignments: [6, 22] },
  { version: 4, size: 33, dataCodewords: 64, ecCodewords: 18, ecBlocks: 2, alignments: [6, 26] },
  { version: 5, size: 37, dataCodewords: 86, ecCodewords: 24, ecBlocks: 2, alignments: [6, 30] },
  { version: 6, size: 41, dataCodewords: 108, ecCodewords: 16, ecBlocks: 4, alignments: [6, 34] },
  { version: 7, size: 45, dataCodewords: 124, ecCodewords: 18, ecBlocks: 4, alignments: [6, 22, 38] },
  { version: 8, size: 49, dataCodewords: 154, ecCodewords: 22, ecBlocks: 4, alignments: [6, 24, 42] },
  { version: 9, size: 53, dataCodewords: 182, ecCodewords: 22, ecBlocks: 5, alignments: [6, 26, 46] },
  { version: 10, size: 57, dataCodewords: 216, ecCodewords: 26, ecBlocks: 5, alignments: [6, 28, 50] },
];

/** Encode string ke byte stream (UTF-8, Mode 4 = Byte) */
function encodeData(text, spec) {
  const utf8 = new TextEncoder().encode(text);
  const bits = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  }

  // Mode Byte: 0100
  pushBits(0b0100, 4);
  // Character count indicator (8 bits untuk v1-9, 16 bits untuk v10+)
  const countBits = spec.version <= 9 ? 8 : 16;
  pushBits(utf8.length, countBits);

  for (let i = 0; i < utf8.length; i++) {
    pushBits(utf8[i], 8);
  }

  // Terminator (hingga 4 nol)
  const maxBits = spec.dataCodewords * 8;
  const rem = maxBits - bits.length;
  for (let i = 0; i < Math.min(4, rem); i++) bits.push(0);

  // Pad ke kelipatan 8
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes alternating 236 dan 17
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const dataBytes = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < spec.dataCodewords; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    dataBytes[i] = b;
  }
  return dataBytes;
}

/** Susun matriks modul QR dengan pola finder, timing, alignment, dan data */
export function generateQrMatrix(text) {
  const utf8Len = new TextEncoder().encode(text).length;
  let spec = null;
  for (let v = 1; v <= 10; v++) {
    const s = QR_SPECS[v];
    const headerBits = 4 + (v <= 9 ? 8 : 16);
    if ((s.dataCodewords * 8 - headerBits) / 8 >= utf8Len) {
      spec = s;
      break;
    }
  }
  if (!spec) spec = QR_SPECS[10];

  const size = spec.size;
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r, c, val, isRes = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (isRes) reserved[r][c] = true;
    }
  }

  // Finder pattern
  function drawFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          setModule(nr, nc, true);
        } else {
          setModule(nr, nc, false);
        }
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Alignment patterns
  if (spec.alignments.length) {
    const coords = spec.alignments;
    for (let i = 0; i < coords.length; i++) {
      for (let j = 0; j < coords.length; j++) {
        const r = coords[i];
        const c = coords[j];
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            setModule(r + dr, c + dc, isBorder || isCenter);
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(4 * spec.version + 9, 8, true);

  // Format info area reservation
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) setModule(8, i, false, true);
    if (!reserved[i][8]) setModule(i, 8, false, true);
  }
  for (let i = size - 8; i < size; i++) {
    if (!reserved[8][i]) setModule(8, i, false, true);
    if (!reserved[i][8]) setModule(i, 8, false, true);
  }

  // Encode data + EC
  const dataBytes = encodeData(text, spec);
  const blockSize = Math.floor(spec.dataCodewords / spec.ecBlocks);
  const ecPerBlock = spec.ecCodewords;

  const dataBlocks = [];
  const ecBlocks = [];
  for (let b = 0; b < spec.ecBlocks; b++) {
    const start = b * blockSize;
    const end = (b === spec.ecBlocks - 1) ? spec.dataCodewords : (b + 1) * blockSize;
    const blockData = dataBytes.slice(start, end);
    dataBlocks.push(blockData);
    ecBlocks.push(rsEncode(blockData, ecPerBlock));
  }

  // Interleave
  const allCodewords = [];
  const maxBlockLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < spec.ecBlocks; b++) {
      if (i < dataBlocks[b].length) allCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < spec.ecBlocks; b++) {
      allCodewords.push(ecBlocks[b][i]);
    }
  }

  // Tempatkan bit ke dalam matriks dengan Mask 0 ((row + col) % 2 === 0)
  const bitStream = [];
  for (let i = 0; i < allCodewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bitStream.push((allCodewords[i] >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (!reserved[row][c]) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
          const mask = (row + c) % 2 === 0;
          matrix[row][c] = Boolean(bit ^ (mask ? 1 : 0));
        }
      }
    }
    upwards = !upwards;
  }

  // Tulis format info (Error Correction M = 00, Mask 0 = 000 -> 0b00000 -> Format Bits 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const formatCoordsTop = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatCoordsTop[i];
    matrix[r][c] = Boolean(formatBits[i]);
  }
  const formatCoordsRight = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatCoordsRight[i];
    matrix[r][c] = Boolean(formatBits[i]);
  }

  return matrix;
}

/** Render QR Code sebagai SVG Element path */
export function QrCodeSvg({ value, size = 180, className = '' }) {
  if (!value) return null;
  const matrix = generateQrMatrix(String(value));
  const count = matrix.length;
  const margin = 2;
  const total = count + margin * 2;
  const cellSize = 10;
  const viewBoxSize = total * cellSize;

  let pathData = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        pathData += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ shapeRendering: 'crispEdges' }}
      role="img"
      aria-label={`QR Code: ${value}`}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      <path d={pathData} fill="#0A192F" />
    </svg>
  );
}

