export class SamplePlaybackController {
  private source: AudioBufferSourceNode | undefined;

  constructor(private readonly context: AudioContext) {}

  async play(samples: Float32Array, sampleRate: number): Promise<void> {
    if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
      throw new RangeError("sampleRate must be finite and positive");
    }
    if (samples.length === 0) throw new RangeError("samples must not be empty");

    this.stop();
    if (this.context.state !== "running") await this.context.resume();
    if (this.context.state !== "running") {
      throw new Error("Audio output is not active");
    }

    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    const copy = new Float32Array(samples.length);
    copy.set(samples);
    buffer.copyToChannel(copy, 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => {
      if (this.source === source) this.source = undefined;
      try { source.disconnect(); } catch { /* already disconnected */ }
    };
    this.source = source;
    try {
      source.start();
    } catch (error) {
      if (this.source === source) this.source = undefined;
      try { source.disconnect(); } catch { /* already disconnected */ }
      throw error;
    }
  }

  stop(): void {
    const source = this.source;
    this.source = undefined;
    if (source === undefined) return;
    source.onended = null;
    try { source.stop(); } catch { /* source may already have ended */ }
    try { source.disconnect(); } catch { /* source may already be disconnected */ }
  }
}
