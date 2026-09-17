/**
 * Shared AudioContext for exam beeps.
 *
 * Browsers only allow an AudioContext to run if it was created/resumed inside a
 * real user gesture. We therefore create ONE context when the student clicks a
 * button (Start / Next / sound check) and reuse it for every beep afterwards.
 */
let ctx: AudioContext | null = null;

type ACtor = typeof AudioContext;

function getCtor(): ACtor | null {
  const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
  return w.AudioContext || w.webkitAudioContext || null;
}

/** MUST run synchronously inside a user gesture (onClick). */
export function unlockBeepAudio(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (!ctx || ctx.state === "closed") ctx = new Ctor();
    void ctx.resume?.();
  } catch {
    /* noop */
  }
}

/** True when the shared context exists and is running. */
export function isBeepReady(): boolean {
  return !!ctx && ctx.state === "running";
}

/**
 * Play a short 880Hz beep on the shared context.
 * Resolves `true` when the beep was actually played, `false` when the browser
 * still blocks audio (caller should then rely on a visual signal).
 */
export async function playBeep(): Promise<boolean> {
  try {
    const Ctor = getCtor();
    if (!Ctor) return false;
    if (!ctx || ctx.state === "closed") ctx = new Ctor();

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* noop */
      }
    }
    if (ctx.state !== "running") return false;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.5;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      setTimeout(finish, 700); // iOS safety latch
      osc.onended = finish;
    });
    return true;
  } catch {
    return false;
  }
}
