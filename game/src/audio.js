// Synthesised sound, no audio assets: WebAudio oscillators and noise buffers.
// Created lazily on the first user gesture, so autoplay rules never block it.
export function createAudio() {
  let ctx = null;
  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(dur, freq, gain) {
    const c = ensure();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(c.destination);
    src.start();
  }
  function tone(freq, dur, gain, type = 'sine') {
    const c = ensure();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }
  return {
    unlock() { ensure(); },
    shot() { noise(0.09, 1800, 0.25); },
    hit() { tone(1200, 0.06, 0.15, 'square'); },
    kill() { tone(880, 0.12, 0.2, 'square'); tone(1320, 0.1, 0.12, 'square'); },
    reload() { tone(440, 0.08, 0.1, 'triangle'); },
    plant() { tone(660, 0.15, 0.2, 'square'); },
    beep() { tone(990, 0.07, 0.15, 'square'); },
    explode() { noise(0.7, 300, 0.5); tone(60, 0.6, 0.4, 'sine'); },
    round() { tone(523, 0.15, 0.18, 'triangle'); tone(784, 0.25, 0.18, 'triangle'); },
  };
}
