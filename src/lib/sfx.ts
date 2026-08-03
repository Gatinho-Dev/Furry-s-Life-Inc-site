/**
 * Sons de interface do LifePay — sintetizados na hora com WebAudio.
 *
 * Nada de arquivos de áudio: cada som é gerado com osciladores e envelopes
 * suaves (estilo Apple/motion), então carrega instantâneo e nunca "estala".
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const KEY = "lp_sfx_muted";

export function sfxMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean) {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    /* ignora */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type ToneOpts = {
  freq: number;
  to?: number;
  dur?: number;
  delay?: number;
  gain?: number;
  wave?: Wave;
};

function tone({ freq, to, dur = 0.16, delay = 0, gain = 1, wave = "sine" }: ToneOpts) {
  const ac = audio();
  if (!ac || !master) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t0);
  if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);

  // envelope: ataque curtíssimo + decaimento exponencial (sem clique)
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur = 0.12, gain = 0.25, delay = 0) {
  const ac = audio();
  if (!ac || !master) return;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 2400;
  filter.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(ac.currentTime + delay);
}

type SfxName =
  | "tap"
  | "toggle"
  | "open"
  | "close"
  | "success"
  | "money"
  | "error"
  | "unlock"
  | "scan"
  | "mail"
  | "notify";

const PLAYERS: Record<SfxName, () => void> = {
  tap: () => tone({ freq: 880, dur: 0.05, gain: 0.35, wave: "sine" }),
  toggle: () => {
    tone({ freq: 660, to: 990, dur: 0.07, gain: 0.3 });
  },
  open: () => {
    tone({ freq: 520, to: 780, dur: 0.16, gain: 0.28 });
    noise(0.08, 0.05, 0.01);
  },
  close: () => tone({ freq: 700, to: 420, dur: 0.14, gain: 0.24 }),
  unlock: () => {
    tone({ freq: 740, dur: 0.1, gain: 0.35 });
    tone({ freq: 1110, dur: 0.16, gain: 0.3, delay: 0.07 });
  },
  scan: () => tone({ freq: 1320, to: 1760, dur: 0.1, gain: 0.22 }),
  // "Ping" ascendente de confirmação (tríade maior) — o som de ação concluída.
  success: () => {
    tone({ freq: 784, dur: 0.14, gain: 0.4 });
    tone({ freq: 1046, dur: 0.16, gain: 0.36, delay: 0.085 });
    tone({ freq: 1568, dur: 0.34, gain: 0.3, delay: 0.17, wave: "triangle" });
  },
  // Dinheiro entrando/saindo: brilho curto + cauda cristalina.
  money: () => {
    noise(0.1, 0.12);
    tone({ freq: 1174, dur: 0.16, gain: 0.34 });
    tone({ freq: 1760, dur: 0.3, gain: 0.28, delay: 0.09, wave: "triangle" });
    tone({ freq: 2349, dur: 0.42, gain: 0.16, delay: 0.16, wave: "sine" });
  },
  error: () => {
    tone({ freq: 320, to: 200, dur: 0.18, gain: 0.34, wave: "triangle" });
    tone({ freq: 240, to: 150, dur: 0.22, gain: 0.26, delay: 0.1, wave: "triangle" });
  },
  mail: () => {
    tone({ freq: 1320, dur: 0.09, gain: 0.3 });
    tone({ freq: 990, dur: 0.18, gain: 0.24, delay: 0.06 });
  },
  notify: () => {
    tone({ freq: 1046, dur: 0.12, gain: 0.32 });
    tone({ freq: 1568, dur: 0.24, gain: 0.24, delay: 0.1, wave: "triangle" });
  },
};

/** Toca um som da interface (silencioso se o usuário desativou). */
export function sfx(name: SfxName) {
  if (typeof window === "undefined" || sfxMuted()) return;
  try {
    PLAYERS[name]();
  } catch {
    /* áudio indisponível — segue sem som */
  }
}

/** Vibração leve quando o aparelho suporta (combina com o som). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignora */
  }
}

export function sfxWithHaptic(name: SfxName, ms = 12) {
  sfx(name);
  haptic(ms);
}
