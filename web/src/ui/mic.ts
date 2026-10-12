export type MicController = {
  start: () => Promise<void>;
  stop: () => void;
  active: () => boolean;
};

export function createMicWatcher(opts: {
  onLevel: (level: number) => void;
  onSpeak: () => void;
}): MicController {
  let micOn = false;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;
  let raf = 0;
  let jumping = false;
  let lastJump = 0;

  function stop() {
    micOn = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void audioCtx?.close();
    audioCtx = null;
    analyser = null;
    opts.onLevel(0);
  }

  async function start() {
    if (micOn) return;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    micOn = true;

    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (!micOn || !analyser) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 4.2);
      opts.onLevel(level);
      const now = performance.now();
      if (level > 0.08 && !jumping && now - lastJump > 260) {
        jumping = true;
        lastJump = now;
        opts.onSpeak();
        window.setTimeout(() => {
          jumping = false;
        }, 280);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  return {
    start,
    stop,
    active: () => micOn,
  };
}
