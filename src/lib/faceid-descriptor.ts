/**
 * Face ID próprio do LifePay — extração de assinatura facial no navegador.
 *
 * O rosto nunca sai do dispositivo como imagem: apenas um vetor numérico
 * normalizado (assinatura) é enviado ao servidor para comparação.
 *
 * v4 — foco total em funcionar em qualquer lugar:
 *  • máscara oval: o fundo (a "sala" onde a pessoa está) é descartado antes de
 *    gerar a assinatura, então mudar de ambiente deixa de reprovar;
 *  • apenas HOG normalizado por célula (L2-hys): estrutura do rosto, invariante
 *    a brilho, cor de parede e temperatura de luz — o bloco de "aparência"
 *    (que carregava a iluminação do local) foi removido;
 *  • multiescala + espelhamento: tolera distância, enquadramento e lado;
 *  • estimativa de pose (yaw/pitch) para exigir que a pessoa realmente gire o
 *    rosto durante o cadastro, como no Face ID de verdade.
 */

const WORK = 64;              // resolução de trabalho (px)
const CELLS = 8;              // 8x8 células
const BINS = 9;               // 9 direções por célula
export const FACE_DIM = CELLS * CELLS * BINS; // 576

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

function l2(v: Float64Array, from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

/** Máscara oval (1 dentro do rosto, 0 no fundo) com borda suave. */
const MASK = (() => {
  const m = new Float64Array(WORK * WORK);
  const cx = (WORK - 1) / 2, cy = (WORK - 1) / 2;
  const rx = WORK * 0.44, ry = WORK * 0.5;
  for (let y = 0; y < WORK; y++) {
    for (let x = 0; x < WORK; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      m[y * WORK + x] = d <= 0.86 ? 1 : d >= 1 ? 0 : (1 - d) / 0.14;
    }
  }
  return m;
})();

export type FaceSample = {
  vector: number[];
  /** contraste do recorte — descarta frames escuros ou sem rosto */
  energy: number;
  /** deslocamento horizontal das feições (-1 esquerda .. +1 direita) */
  yaw: number;
  /** deslocamento vertical das feições (-1 acima .. +1 abaixo) */
  pitch: number;
};

/** Converte um frame de vídeo numa assinatura facial normalizada. */
export function frameToDescriptor(
  source: HTMLVideoElement | HTMLCanvasElement,
  box: Box,
  canvas: HTMLCanvasElement,
  mirror = false,
): FaceSample {
  canvas.width = WORK;
  canvas.height = WORK;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, WORK, WORK);
  if (mirror) ctx.setTransform(-1, 0, 0, 1, WORK, 0);
  ctx.drawImage(source as any, box.x, box.y, box.w, box.h, 0, 0, WORK, WORK);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const { data } = ctx.getImageData(0, 0, WORK, WORK);

  const gray = new Float64Array(WORK * WORK);
  for (let i = 0; i < WORK * WORK; i++) {
    const p = i * 4;
    // Compressão gamma (sqrt) reduz o efeito da luz forte/fraca.
    gray[i] = Math.sqrt((0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255) * 255;
  }

  // Energia (contraste) medida só dentro do oval.
  let gMean = 0, wSum = 0;
  for (let i = 0; i < gray.length; i++) { gMean += gray[i] * MASK[i]; wSum += MASK[i]; }
  gMean /= wSum || 1;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += MASK[i] * (gray[i] - gMean) ** 2;
  const energy = Math.sqrt(variance / (wSum || 1)) / 255;

  const at = (x: number, y: number) =>
    gray[Math.min(WORK - 1, Math.max(0, y)) * WORK + Math.min(WORK - 1, Math.max(0, x))];

  // ---- HOG mascarado: voto bilinear em células e direções ----
  const hog = new Float64Array(FACE_DIM);
  const cellSize = WORK / CELLS;
  let eSum = 0, exSum = 0, eySum = 0;
  for (let y = 0; y < WORK; y++) {
    for (let x = 0; x < WORK; x++) {
      const w = MASK[y * WORK + x];
      if (w <= 0) continue;
      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const mag = Math.hypot(gx, gy) * w;
      if (mag < 1e-6) continue;

      // centroide de energia de borda → proxy de pose
      eSum += mag; exSum += mag * x; eySum += mag * y;

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

  // Normalização por célula (L2-hys): invariância total a contraste local,
  // que é o que muda quando a pessoa troca de ambiente/iluminação.
  for (let c = 0; c < CELLS * CELLS; c++) {
    const base = c * BINS;
    let n = l2(hog, base, base + BINS) || 1;
    for (let i = base; i < base + BINS; i++) hog[i] = Math.min(hog[i] / n, 0.25);
    n = l2(hog, base, base + BINS) || 1;
    for (let i = base; i < base + BINS; i++) hog[i] /= n;
  }

  // Normalização global (norma 1) para o cosseno ficar bem condicionado.
  const gn = l2(hog, 0, FACE_DIM) || 1;
  const vector: number[] = new Array(FACE_DIM);
  for (let i = 0; i < FACE_DIM; i++) vector[i] = Number((hog[i] / gn).toFixed(5));

  const cxE = eSum ? exSum / eSum : (WORK - 1) / 2;
  const cyE = eSum ? eySum / eSum : (WORK - 1) / 2;
  const yawRaw = (cxE - (WORK - 1) / 2) / (WORK / 2);
  return {
    vector,
    energy,
    // no espelho o sinal do yaw inverte
    yaw: mirror ? -yawRaw : yawRaw,
    pitch: (cyE - (WORK - 1) / 2) / (WORK / 2),
  };
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
export const FACE_VERSION = 4;

/**
 * Limites de aceitação. Com HOG mascarado e normalizado por célula, a mesma
 * pessoa em outro ambiente costuma ficar acima de 0.72, enquanto pessoas
 * diferentes ficam perto de 0.45 — daí a folga abaixo.
 */
export const FACE_MATCH_THRESHOLD = 0.66;
/** Mínimo aceito para uma única amostra isolada (evita falso positivo). */
export const FACE_SINGLE_MIN = 0.58;
export const FACE_MIN_ENERGY = 0.04;

/** Quantos frames são combinados em cada amostra (média temporal). */
export const FACE_FRAMES_PER_SAMPLE = 3;

/* ------------------------------------------------------------------ *
 * Captura multiescala + espelhada                                     *
 * ------------------------------------------------------------------ */
export const FACE_SCALES = [0.88, 1, 1.14] as const;

function scaleBox(box: Box, k: number): Box {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const w = box.w * k;
  const h = box.h * k;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Descritores do mesmo frame em várias escalas (e opcionalmente espelhados). */
export function frameToDescriptors(
  source: HTMLVideoElement | HTMLCanvasElement,
  box: Box,
  canvas: HTMLCanvasElement,
  opts: { mirror?: boolean } = {},
): { vectors: number[][]; energy: number; yaw: number; pitch: number } {
  const vectors: number[][] = [];
  let energy = 0, yaw = 0, pitch = 0;
  for (const k of FACE_SCALES) {
    const r = frameToDescriptor(source, scaleBox(box, k), canvas, opts.mirror);
    vectors.push(r.vector);
    energy = Math.max(energy, r.energy);
    yaw += r.yaw / FACE_SCALES.length;
    pitch += r.pitch / FACE_SCALES.length;
  }
  return { vectors, energy, yaw, pitch };
}

/* ------------------------------------------------------------------ *
 * Etapas do cadastro — exigem movimento real do rosto                 *
 * ------------------------------------------------------------------ */
export type PoseAxis = "front" | "right" | "left" | "up" | "down";

export type EnrollStep = {
  axis: PoseAxis;
  title: string;
  hint: string;
};

export const FACE_ENROLL_STEPS: readonly EnrollStep[] = [
  { axis: "front", title: "Olhe para a frente", hint: "Centralize o rosto no círculo" },
  { axis: "right", title: "Gire devagar para a direita", hint: "Vire a cabeça para a sua direita" },
  { axis: "front", title: "Volte para o centro", hint: "Olhe para a frente novamente" },
  { axis: "left", title: "Gire devagar para a esquerda", hint: "Vire a cabeça para a sua esquerda" },
  { axis: "front", title: "Volte para o centro", hint: "Olhe para a frente novamente" },
  { axis: "up", title: "Levante o queixo", hint: "Incline a cabeça para cima" },
  { axis: "down", title: "Abaixe o queixo", hint: "Incline a cabeça para baixo" },
  { axis: "front", title: "Olhe para a frente", hint: "Última etapa" },
] as const;

/** Quanto o rosto precisa se mover (em unidades de yaw/pitch) por etapa. */
export const POSE_DELTA = 0.045;
/** Tolerância para considerar o rosto "de frente" outra vez. */
export const POSE_CENTER = 0.03;

/**
 * Verifica se a pose atual satisfaz a etapa pedida, comparando com a linha de
 * base capturada na primeira etapa frontal. `relax` (0..1) afrouxa o limite
 * gradualmente para nunca travar a pessoa numa etapa.
 */
export function poseSatisfies(
  axis: PoseAxis,
  pose: { yaw: number; pitch: number },
  base: { yaw: number; pitch: number },
  relax = 0,
): boolean {
  const need = POSE_DELTA * (1 - 0.55 * Math.min(1, Math.max(0, relax)));
  const dy = pose.yaw - base.yaw;
  const dp = pose.pitch - base.pitch;
  switch (axis) {
    case "right": return dy >= need;
    case "left": return -dy >= need;
    case "up": return -dp >= need;
    case "down": return dp >= need;
    case "front":
      return Math.abs(dy) <= POSE_CENTER + need && Math.abs(dp) <= POSE_CENTER + need;
  }
}

/** Compatibilidade: rótulos antigos das etapas. */
export const FACE_STEPS = FACE_ENROLL_STEPS.map((s) => s.title);
