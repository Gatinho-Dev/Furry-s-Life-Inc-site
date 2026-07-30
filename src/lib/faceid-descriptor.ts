/**
 * Face ID próprio do LifePay — extração de assinatura facial no navegador.
 *
 * O rosto nunca sai do dispositivo como imagem: apenas um vetor numérico
 * normalizado (assinatura) é enviado ao servidor para comparação.
 *
 * v2: normalização local de contraste + gradientes (Sobel). Isso deixa a
 * assinatura muito mais estável a mudanças de iluminação e de distância —
 * que era o motivo do reconhecimento falhar na versão anterior.
 */

const GRID = 12;             // 12x12 células
const WORK = 48;             // resolução intermediária de trabalho
export const FACE_DIM = GRID * GRID * 2; // intensidade + gradiente = 288

type Box = { x: number; y: number; w: number; h: number };

/** Detecta o rosto com a API nativa quando disponível; senão usa o oval central. */
export async function detectFaceBox(source: HTMLVideoElement): Promise<Box> {
  const vw = source.videoWidth || 640;
  const vh = source.videoHeight || 480;
  const FD = (globalThis as any).FaceDetector;
  if (FD) {
    try {
      const det = new FD({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await det.detect(source);
      const bb = faces?.[0]?.boundingBox;
      if (bb && bb.width > 40) {
        // Quadrado em volta do rosto — mantém a proporção estável entre capturas.
        const size = Math.max(bb.width, bb.height) * 1.18;
        const cx = bb.x + bb.width / 2;
        const cy = bb.y + bb.height / 2;
        return {
          x: Math.max(0, Math.min(vw - size, cx - size / 2)),
          y: Math.max(0, Math.min(vh - size, cy - size / 2)),
          w: Math.min(size, vw),
          h: Math.min(size, vh),
        };
      }
    } catch {
      /* fallback abaixo */
    }
  }
  const size = Math.min(vw, vh) * 0.62;
  return { x: (vw - size) / 2, y: (vh - size) / 2 - size * 0.05, w: size, h: size };
}

function boxBlur(src: Float64Array, n: number, radius: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= n) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= n) continue;
          sum += src[yy * n + xx];
          cnt++;
        }
      }
      out[y * n + x] = sum / cnt;
    }
  }
  return out;
}

function pool(src: Float64Array, n: number, grid: number): Float64Array {
  const cell = n / grid;
  const out = new Float64Array(grid * grid);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let sum = 0, cnt = 0;
      for (let y = Math.floor(gy * cell); y < Math.floor((gy + 1) * cell); y++) {
        for (let x = Math.floor(gx * cell); x < Math.floor((gx + 1) * cell); x++) {
          sum += src[y * n + x];
          cnt++;
        }
      }
      out[gy * grid + gx] = cnt ? sum / cnt : 0;
    }
  }
  return out;
}

function normalize(v: Float64Array): void {
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i];
  mean /= v.length;
  let norm = 0;
  for (let i = 0; i < v.length; i++) { v[i] -= mean; norm += v[i] * v[i]; }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
}

/** Converte um frame de vídeo numa assinatura facial normalizada. */
export function frameToDescriptor(
  source: HTMLVideoElement,
  box: Box,
  canvas: HTMLCanvasElement,
): { vector: number[]; energy: number } {
  canvas.width = WORK;
  canvas.height = WORK;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, WORK, WORK);
  const { data } = ctx.getImageData(0, 0, WORK, WORK);

  const gray = new Float64Array(WORK * WORK);
  for (let i = 0; i < WORK * WORK; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  // Contraste/brilho global: usado para descartar frames escuros ou sem rosto.
  let gMean = 0;
  for (let i = 0; i < gray.length; i++) gMean += gray[i];
  gMean /= gray.length;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += (gray[i] - gMean) ** 2;
  const energy = Math.sqrt(variance / gray.length) / 255;

  // Normalização local de iluminação (subtrai o brilho de fundo).
  const blurred = boxBlur(gray, WORK, 3);
  const local = new Float64Array(WORK * WORK);
  for (let i = 0; i < gray.length; i++) local[i] = gray[i] - blurred[i];

  // Gradiente (Sobel) — estrutura do rosto, robusta à iluminação.
  const grad = new Float64Array(WORK * WORK);
  const at = (x: number, y: number) =>
    gray[Math.min(WORK - 1, Math.max(0, y)) * WORK + Math.min(WORK - 1, Math.max(0, x))];
  for (let y = 0; y < WORK; y++) {
    for (let x = 0; x < WORK; x++) {
      const gx =
        -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) +
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      grad[y * WORK + x] = Math.hypot(gx, gy);
    }
  }

  const intensity = pool(local, WORK, GRID);
  const gradient = pool(grad, WORK, GRID);
  normalize(intensity);
  normalize(gradient);

  const vector: number[] = new Array(FACE_DIM);
  for (let i = 0; i < GRID * GRID; i++) {
    vector[i] = Number((intensity[i] * 0.7071).toFixed(4));
    vector[GRID * GRID + i] = Number((gradient[i] * 0.7071).toFixed(4));
  }
  return { vector, energy };
}

/** Similaridade do cosseno (vetores já normalizados). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Versão da assinatura — permite invalidar cadastros antigos e incompatíveis. */
export const FACE_VERSION = 2;

export const FACE_MATCH_THRESHOLD = 0.72;
export const FACE_MIN_ENERGY = 0.045;

export const FACE_STEPS = [
  "Olhe para a frente",
  "Vire levemente para a direita",
  "Vire levemente para a esquerda",
  "Incline o queixo para cima",
  "Incline o queixo para baixo",
  "Olhe para a frente novamente",
] as const;
