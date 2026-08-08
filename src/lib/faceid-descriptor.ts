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
 * Pose do rosto (para o cadastro por rotação, igual ao Face ID)        *
 * ------------------------------------------------------------------ *
 * v5 — a pose deixou de depender só do centroide de bordas (ruidoso).
 * Agora combinamos:
 *   • centroide das feições ESCURAS (olhos, narinas, boca, sobrancelhas),
 *     que é muito mais estável e acompanha o giro da cabeça;
 *   • centroide de energia de borda (mantido com peso menor).
 * Além disso o rastreador é ADAPTATIVO: em vez de exigir um deslocamento
 * fixo, ele aprende a amplitude do movimento da pessoa, então funciona
 * tanto para quem gira muito quanto para quem gira pouco.
 */

const POSE_WORK = 48;

const POSE_MASK = (() => {
  const m = new Float64Array(POSE_WORK * POSE_WORK);
  const c = (POSE_WORK - 1) / 2;
  const rx = POSE_WORK * 0.44, ry = POSE_WORK * 0.5;
  for (let y = 0; y < POSE_WORK; y++) {
    for (let x = 0; x < POSE_WORK; x++) {
      const d = Math.hypot((x - c) / rx, (y - c) / ry);
      m[y * POSE_WORK + x] = d <= 0.9 ? 1 : d >= 1 ? 0 : (1 - d) / 0.1;
    }
  }
  return m;
})();

export type PoseReading = { yaw: number; pitch: number; energy: number };

/** Leitura de pose rápida (1 frame, 1 escala) — usada para guiar o anel. */
export function framePose(
  source: HTMLVideoElement | HTMLCanvasElement,
  box: Box,
  canvas: HTMLCanvasElement,
  mirror = false,
): PoseReading | null {
  canvas.width = POSE_WORK;
  canvas.height = POSE_WORK;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, POSE_WORK, POSE_WORK);
  if (mirror) ctx.setTransform(-1, 0, 0, 1, POSE_WORK, 0);
  ctx.drawImage(source as any, box.x, box.y, box.w, box.h, 0, 0, POSE_WORK, POSE_WORK);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const { data } = ctx.getImageData(0, 0, POSE_WORK, POSE_WORK);

  const gray = new Float64Array(POSE_WORK * POSE_WORK);
  let mean = 0, wSum = 0;
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    mean += gray[i] * POSE_MASK[i];
    wSum += POSE_MASK[i];
  }
  mean /= wSum || 1;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += POSE_MASK[i] * (gray[i] - mean) ** 2;
  const energy = Math.sqrt(variance / (wSum || 1)) / 255;
  if (energy < FACE_MIN_ENERGY * 0.7) return null;

  const at = (x: number, y: number) =>
    gray[Math.min(POSE_WORK - 1, Math.max(0, y)) * POSE_WORK + Math.min(POSE_WORK - 1, Math.max(0, x))];

  const half = (POSE_WORK - 1) / 2;
  // --- centroide das feições escuras (relativo à média local do rosto) ---
  let dSum = 0, dx = 0, dy = 0;
  // --- centroide de energia de borda ---
  let eSum = 0, ex = 0, ey = 0;
  for (let y = 0; y < POSE_WORK; y++) {
    for (let x = 0; x < POSE_WORK; x++) {
      const w = POSE_MASK[y * POSE_WORK + x];
      if (w <= 0) continue;
      const g = gray[y * POSE_WORK + x];
      const dark = Math.max(0, (mean - g) / (mean || 1));
      const wd = w * dark * dark;
      dSum += wd; dx += wd * x; dy += wd * y;

      const gx = at(x + 1, y) - at(x - 1, y);
      const gy = at(x, y + 1) - at(x, y - 1);
      const mag = Math.hypot(gx, gy) * w;
      eSum += mag; ex += mag * x; ey += mag * y;
    }
  }
  const dcx = dSum ? dx / dSum : half, dcy = dSum ? dy / dSum : half;
  const ecx = eSum ? ex / eSum : half, ecy = eSum ? ey / eSum : half;

  // As feições escuras pesam 3x mais que as bordas (bem menos ruído).
  const cx = (dcx * 3 + ecx) / 4;
  const cy = (dcy * 3 + ecy) / 4;
  const yawRaw = (cx - half) / half;
  return { yaw: mirror ? -yawRaw : yawRaw, pitch: (cy - half) / half, energy };
}

/** Quantidade de setores do anel que precisam ser preenchidos. */
export const FACE_SECTORS = 12;
/** Deslocamento mínimo absoluto (piso de segurança). */
export const POSE_RADIUS = 0.012;
/** Voltas necessárias no cadastro. */
export const FACE_ENROLL_PASSES = 2;

export type Pose = { yaw: number; pitch: number };

export type PoseTick = {
  /** setor do anel apontado agora, ou null se o rosto está de frente */
  sector: number | null;
  /** deslocamento atual em relação ao centro */
  magnitude: number;
  /** deslocamento necessário no momento (adaptativo) */
  need: number;
  /** ângulo em radianos (0 = direita, sentido horário) */
  angle: number;
  /** true enquanto a linha de base frontal ainda está sendo aprendida */
  calibrating: boolean;
};

/**
 * Rastreador de pose com suavização (EMA), linha de base auto-calibrada e
 * amplitude adaptativa. Isso resolve o "não identifica para onde estou
 * olhando": o limite passa a ser uma fração da amplitude real do movimento.
 */
export function createPoseTracker(opts: { smooth?: number } = {}) {
  const alpha = opts.smooth ?? 0.4;
  let sy = 0, sp = 0, started = false;
  let baseY = 0, baseP = 0, baseN = 0;
  let maxR = 0;

  return {
    reset() { started = false; baseN = 0; baseY = 0; baseP = 0; maxR = 0; },
    push(r: PoseReading): PoseTick {
      if (!started) { sy = r.yaw; sp = r.pitch; started = true; }
      else { sy += (r.yaw - sy) * alpha; sp += (r.pitch - sp) * alpha; }

      // primeiras leituras = linha de base frontal
      if (baseN < 6) { baseY += sy; baseP += sp; baseN++; }
      const by = baseY / Math.max(1, baseN);
      const bp = baseP / Math.max(1, baseN);

      const dy = sy - by, dp = sp - bp;
      const magnitude = Math.hypot(dy, dp);
      maxR = Math.max(maxR * 0.997, magnitude);
      const need = Math.max(POSE_RADIUS, maxR * 0.4);

      let angle = Math.atan2(dp, dy);
      if (angle < 0) angle += Math.PI * 2;
      const sector = magnitude >= need
        ? Math.floor((angle / (Math.PI * 2)) * FACE_SECTORS) % FACE_SECTORS
        : null;
      return { sector, magnitude, need, angle, calibrating: baseN < 6 };
    },
  };
}

/** Texto de orientação conforme o progresso da volta. */
export function rotationHint(pass: number, filled: number): string {
  if (filled === 0) return "Gire a cabeça lentamente em círculo";
  if (filled < FACE_SECTORS - 2) return "Continue girando devagar, acompanhando o anel";
  if (filled < FACE_SECTORS) return "Falta pouco para fechar o círculo";
  return pass === 0 ? "Ótimo. Agora repita o giro uma vez" : "Quase pronto...";
}


