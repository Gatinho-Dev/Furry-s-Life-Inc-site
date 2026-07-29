/**
 * Face ID próprio do LifePay — extração de assinatura facial no navegador.
 *
 * O rosto nunca sai do dispositivo como imagem: apenas um vetor numérico
 * normalizado (assinatura) é enviado ao servidor para comparação.
 */

export const FACE_DIM = 16 * 16; // 256

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
        const pad = bb.width * 0.12;
        return {
          x: Math.max(0, bb.x - pad),
          y: Math.max(0, bb.y - pad),
          w: Math.min(vw, bb.width + pad * 2),
          h: Math.min(vh, bb.height + pad * 2),
        };
      }
    } catch {
      /* fallback abaixo */
    }
  }
  const size = Math.min(vw, vh) * 0.62;
  return { x: (vw - size) / 2, y: (vh - size) / 2 - size * 0.05, w: size, h: size };
}

/** Converte um frame de vídeo numa assinatura facial normalizada (256 dimensões). */
export function frameToDescriptor(
  source: HTMLVideoElement,
  box: Box,
  canvas: HTMLCanvasElement,
): { vector: number[]; energy: number } {
  const N = 16;
  const SS = 64; // amostragem intermediária para suavizar ruído
  canvas.width = SS;
  canvas.height = SS;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, SS, SS);
  const { data } = ctx.getImageData(0, 0, SS, SS);

  const cell = SS / N;
  const raw = new Float64Array(FACE_DIM);
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      let sum = 0;
      let count = 0;
      for (let y = gy * cell; y < (gy + 1) * cell; y++) {
        for (let x = gx * cell; x < (gx + 1) * cell; x++) {
          const i = (y * SS + x) * 4;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          count++;
        }
      }
      raw[gy * N + gx] = sum / count;
    }
  }

  // Normalização de iluminação: média zero + norma unitária.
  let mean = 0;
  for (let i = 0; i < FACE_DIM; i++) mean += raw[i];
  mean /= FACE_DIM;
  let norm = 0;
  for (let i = 0; i < FACE_DIM; i++) {
    raw[i] -= mean;
    norm += raw[i] * raw[i];
  }
  norm = Math.sqrt(norm) || 1;
  const vector: number[] = new Array(FACE_DIM);
  for (let i = 0; i < FACE_DIM; i++) vector[i] = Number((raw[i] / norm).toFixed(4));

  // "energia" = contraste do recorte; frames escuros/sem rosto ficam próximos de 0.
  return { vector, energy: norm / FACE_DIM };
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot; // vetores já normalizados
}

export const FACE_MATCH_THRESHOLD = 0.88;
export const FACE_MIN_ENERGY = 0.12;

export const FACE_STEPS = [
  "Olhe para a frente",
  "Vire levemente para a direita",
  "Vire levemente para a esquerda",
  "Incline o queixo para cima",
  "Incline o queixo para baixo",
  "Olhe para a frente novamente",
] as const;
