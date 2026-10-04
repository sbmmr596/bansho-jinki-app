/**
 * マイサーバーのQR表示。QRの行列づくりは qrcode-generator（MIT）を必要なときだけ読み込む。
 * 行列から画素への変換は純粋関数で、テストで jsQR に戻して確かめる。
 */

export type QrMatrix = boolean[][];

/** 白い余白（quiet zone）。規格どおり4マス。 */
export const QR_QUIET = 4;

/** 文字列からQR行列を作る（誤り訂正 M。リンクは70文字ほどなので小さいバージョンで収まる）。 */
export async function makeQrMatrix(text: string): Promise<QrMatrix> {
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const rows: QrMatrix = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** 1マス cell 画素、周りに quiet マスの白。RGBA（不透明）で返す。 */
export function qrToRgba(
  matrix: QrMatrix,
  cell: number,
  quiet: number = QR_QUIET,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const total = matrix.length + quiet * 2;
  const size = total * cell;
  const data = new Uint8ClampedArray(new ArrayBuffer(size * size * 4)).fill(255);
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix.length; c++) {
      if (!matrix[r]![c]) continue;
      for (let y = 0; y < cell; y++) {
        const rowStart = ((r + quiet) * cell + y) * size;
        for (let x = 0; x < cell; x++) {
          const i = (rowStart + (c + quiet) * cell + x) * 4;
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

/** canvas に描く。表示サイズは CSS で決めるので、内部は読み取りやすい大きさ（約640px以上）にする。 */
export function drawQrToCanvas(canvas: HTMLCanvasElement, matrix: QrMatrix, minPx = 640) {
  const total = matrix.length + QR_QUIET * 2;
  const cell = Math.max(4, Math.ceil(minPx / total));
  const { data, width, height } = qrToRgba(matrix, cell);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
}
