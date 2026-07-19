/** Play a short beep using Web Audio API with an iOS-safe timeout latch. */
export function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };

    setTimeout(finish, 700); // chốt an toàn cho iOS

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.5;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => {
        try {
          ctx.close();
        } catch {
          /* noop */
        }
        finish();
      };
    } catch {
      finish();
    }
  });
}