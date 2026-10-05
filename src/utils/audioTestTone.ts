/** 使用者點擊才產生短測試音；不連外、不錄音、不擷取麥克風。 */
export async function playAudioTestTone(): Promise<void> {
  const context = new AudioContext();
  let oscillator: OscillatorNode | undefined;
  try {
    await context.resume();
    if (context.state !== 'running') throw new Error('瀏覽器尚未允許聲音，請再按一次測試音。');
    oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 523.25;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, context.currentTime + 0.025);
    gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.6);
    oscillator.connect(gain); gain.connect(context.destination);
    const ended = new Promise<void>(resolve => { oscillator!.onended = () => resolve(); });
    oscillator.start(); oscillator.stop(context.currentTime + 0.65);
    await ended;
  } finally {
    oscillator?.disconnect();
    await context.close();
  }
}
