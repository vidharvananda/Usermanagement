function playBeepSequence() {
  const audioContext = new AudioContext();
  const now = audioContext.currentTime;
  const notes = [880, 1175, 880, 1175];

  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const start = now + index * 0.2;
    const end = start + 0.14;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(start);
    oscillator.stop(end);
  });

  // Close after playback to release resources.
  setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 1200);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "play-alert-sound") {
    playBeepSequence();
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
