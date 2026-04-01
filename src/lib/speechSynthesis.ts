// Browser-based TTS using Web Speech API (en-GB male voice)

let voicesLoaded = false;

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
    // Fallback timeout
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1000);
  });
}

export async function speakText(text: string): Promise<void> {
  if (!('speechSynthesis' in window)) return;

  speechSynthesis.cancel();

  const voices = await ensureVoices();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    // Try to find an en-GB male voice
    const enGBMale = voices.find(
      (v) => v.lang === 'en-GB' && /male|daniel|george/i.test(v.name)
    );
    const enGB = voices.find((v) => v.lang === 'en-GB');
    const enAny = voices.find((v) => v.lang.startsWith('en'));

    if (enGBMale) utterance.voice = enGBMale;
    else if (enGB) utterance.voice = enGB;
    else if (enAny) utterance.voice = enAny;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    speechSynthesis.speak(utterance);
  });
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}
