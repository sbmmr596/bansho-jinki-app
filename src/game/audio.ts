let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.04) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function sfx(kind: "hit" | "crit" | "ko" | "heal" | "win" | "lose" | "summon" | "click") {
  if (!ctx) return;
  switch (kind) {
    case "click":
      beep(520, 0.05, "square", 0.02);
      break;
    case "hit":
      beep(180, 0.09, "sawtooth", 0.05);
      break;
    case "crit":
      beep(420, 0.12, "sawtooth", 0.06);
      beep(640, 0.1, "square", 0.03);
      break;
    case "heal":
      beep(480, 0.12, "sine", 0.04);
      break;
    case "ko":
      beep(90, 0.22, "triangle", 0.06);
      break;
    case "win":
      beep(392, 0.16, "square", 0.04);
      setTimeout(() => beep(523, 0.2, "square", 0.04), 120);
      break;
    case "lose":
      beep(160, 0.28, "sawtooth", 0.05);
      break;
    case "summon":
      beep(330, 0.18, "sine", 0.05);
      setTimeout(() => beep(495, 0.22, "sine", 0.04), 140);
      break;
  }
}
