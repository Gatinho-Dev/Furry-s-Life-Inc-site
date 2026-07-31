/**
 * Face ID próprio do LifePay — extração de assinatura facial no navegador.
 *
 * O rosto nunca sai do dispositivo como imagem: apenas um vetor numérico
 * normalizado (assinatura) é enviado ao servidor para comparação.
 *
 * v3: descritor HOG (histograma de gradientes orientados, 8x8 células x 8
 * direções) + aparência com iluminação normalizada. É o mesmo princípio usado
 * em reconhecimento facial clássico: muito mais discriminativo e estável a
 * mudanças de luz, distância e leve rotação do que a versão anterior.
 */

const WORK = 64;              // resolução de trabalho (px)
const CELLS = 8;              // 8x8 células
const BINS = 8;               // 8 direções por célula
const HOG_DIM = CELLS * CELLS * BINS;   // 512
const APP_DIM = CELLS * CELLS;          // 64
export const FACE_DIM = HOG_DIM + APP_DIM; // 576

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
        const size = Math.max(bb.width, bb.height) * 1.2;
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

function l2(v: Float64Array | number[], from = 0, to?: number): number {
  const end = to ?? v.length;
  let s = 0;
  for (let i = from; i < end; i++) s += (v as any)[i] * (v as any)[i];
  return Math.sqrt(s);
}

/** Centraliza (média zero) e normaliza (norma 1) um trecho do vetor. */
function centerNormalize(v: Float64Array, from: number, to: number): void {
  let mean = 0;
  for (let i = from; i < to; i++) mean += v[i];
  mean /= to - from;
  for (let i = from; i < to; i++) v[i] -= mean;
  const n = l2(v, from, to) || 1;
  for (let i = from; i < to; i++) v[i] /= n;
}

/** Converte um frame de vídeo numa assinatura facial normalizada. */
export function frameToDescriptor(
  source: HTMLVideoElement | HTMLCanvasElement,
  box: Box,
  canvas: HTMLCanvasElement,
): { vector: number[]; energy: number } {
  canvas.width = WORK;
  canvas.height = WORK;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source as any, box.x, box.y, box.w, box.h, 0, 0, WORK, WORK);
  const { data } = ctx.getImageData(0, 0, WORK, WORK);

  const gray = new Float64Array(WORK * WORK);
  for (let i = 0; i < WORK * WORK; i++) {
    const p = i * 4;
    // Compressão gamma (sqrt) reduz o efeito da luz forte/fraca.
    gray[i] = Math.sqrt((0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255) * 255;
  }

  // Energia (contraste) — descarta frames escuros ou sem rosto.
  let gMean = 0;
  for (let i = 0; i < gray.length; i++) gMean += gray[i];
  gMean /= gray.length;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += (gray[i] - gMean) ** 2;
  const energy = Math.sqrt(variance / gray.length) / 255;

  const at = (x: number, y: number) =>
    gray[Math.min(WORK - 1, Math.max(0, y)) * WORK + Math.min(WORK - 1, Math.max(0, x))];

  // ---- HOG: histograma de gradientes com voto bilinear em células/direções ----
  const hog = new Float64Array(HOG_DIM);
  const cellSize = WORK / CELLS;
  for (let y = 0; y < WORK; y++) {
    for (let x = 0; x < WORK; x++) {
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const mag = Math.hypot(gx, gy);
      if (mag < 1e-6) continue;
      let ang = Math.atan2(gy, gx);
      if (ang < 0) ang += Math.PI;               // gradiente sem sinal (0..pi)
      const bin = (ang / Math.PI) * BINS;
      const b0 = Math.floor(bin) % BINS;
      const b1 = (b0 + 1) % BINS;
      const wb = bin - Math.floor(bin);

      const cx = x / cellSize - 0.5;
      const cy = y / cellSize - 0.5;
      const cx0 = Math.floor(cx), cy0 = Math.floor(cy);
      const fx = cx - cx0, fy = cy - cy0;

      for (const [ci, cw] of [[cx0, 1 - fx], [cx0 + 1, fx]] as const) {
        if (ci < 0 || ci >= CELLS || cw <= 0) continue;
        for (const [ri, rw] of [[cy0, 1 - fy], [cy0 + 1, fy]] as const) {
          if (ri < 0 || ri >= CELLS || rw <= 0) continue;
          const base = (ri * CELLS + ci) * BINS;
          hog[base + b0] += mag * cw * rw * (1 - wb);
          hog[base + b1] += mag * cw * rw * wb;
        }
      }
    }
  }

  // Normalização por célula (L2-hys): invariância a contraste local.
  for (let c = 0; c < CELLS * CELLS; c++) {
    const base = c * BINS;
    let n = l2(hog, base, base + BINS) || 1;
    for (let i = base; i < base + BINS; i++) hog[i] = Math.min(hog[i] / n, 0.25);
    n = l2(hog, base, base + BINS) || 1;
    for (let i = base; i < base + BINS; i++) hog[i] /= n;
  }

  // ---- Aparência com iluminação normalizada (formato do rosto) ----
  const blurred = boxBlur(gray, WORK, 4);
  const app = new Float64Array(APP_DIM);
  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      let sum = 0, cnt = 0;
      for (let y = Math.floor(cy * cellSize); y < Math.floor((cy + 1) * cellSize); y++) {
        for (let x = Math.floor(cx * cellSize); x < Math.floor((cx + 1) * cellSize); x++) {
          sum += gray[y * WORK + x] - blurred[y * WORK + x];
          cnt++;
        }
      }
      app[cy * CELLS + cx] = cnt ? sum / cnt : 0;
    }
  }

  const full = new Float64Array(FACE_DIM);
  full.set(hog, 0);
  full.set(app, HOG_DIM);
  // Centralizar cada bloco torna o cosseno realmente discriminativo entre pessoas.
  centerNormalize(full, 0, HOG_DIM);
  centerNormalize(full, HOG_DIM, FACE_DIM);

  const W_HOG = 0.88, W_APP = 0.47; // pesos (soma dos quadrados = 1)
  const vector: number[] = new Array(FACE_DIM);
  for (let i = 0; i < HOG_DIM; i++) vector[i] = Number((full[i] * W_HOG).toFixed(5));
  for (let i = HOG_DIM; i < FACE_DIM; i++) vector[i] = Number((full[i] * W_APP).toFixed(5));
  return { vector, energy };
}

/** Média de várias assinaturas (reduz ruído do sensor) — já renormalizada. */
export function averageDescriptors(list: number[][]): number[] {
  const out = new Array(FACE_DIM).fill(0);
  for (const v of list) for (let i = 0; i < FACE_DIM; i++) out[i] += v[i] ?? 0;
  let n = 0;
  for (let i = 0; i < FACE_DIM; i++) n += out[i] * out[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < FACE_DIM; i++) out[i] = Number((out[i] / n).toFixed(5));
  return out;
}

/** Similaridade do cosseno (vetores já normalizados). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** Versão da assinatura — permite invalidar cadastros antigos e incompatíveis. */
export const FACE_VERSION = 3;

/** Limite de aceitação (cosseno médio das melhores amostras). */
export const FACE_MATCH_THRESHOLD = 0.6;
/** Mínimo aceito para uma única amostra isolada (evita falso positivo). */
export const FACE_SINGLE_MIN = 0.48;
export const FACE_MIN_ENERGY = 0.05;

/** Quantos frames são combinados em cada amostra (média temporal). */
export const FACE_FRAMES_PER_SAMPLE = 3;

export const FACE_STEPS = [
  "Olhe para a frente",
  "Vire levemente para a direita",
  "Vire levemente para a esquerda",
  "Incline o queixo para cima",
  "Incline o queixo para baixo",
  "Aproxime um pouco o rosto",
  "Afaste um pouco o rosto",
  "Olhe para a frente novamente",
] as const;
