import { DEFAULT_CAPTURE_CONFIG, type CaptureConfig } from "./config";
import { Float32RingBuffer } from "./ring-buffer";
import { measureBlock, shouldTrigger } from "./trigger";
import type { AudioCapture, CaptureEngineEvent, CaptureState } from "./types";

function millisecondsToSamples(milliseconds: number, sampleRate: number): number {
  return Math.max(1, Math.round((milliseconds / 1000) * sampleRate));
}

function validateConfig(config: CaptureConfig): void {
  if (config.warmupMs < 0 || config.preTriggerMs <= 0 || config.postTriggerMs <= 0) {
    throw new RangeError("Capture durations are invalid");
  }
  if (config.minRms < 0 || config.minPeak < 0) throw new RangeError("Trigger floors must be non-negative");
  if (config.rmsNoiseMultiplier <= 0 || config.peakNoiseMultiplier <= 0) {
    throw new RangeError("Noise multipliers must be positive");
  }
  if (!(config.noiseSmoothing > 0 && config.noiseSmoothing <= 1)) {
    throw new RangeError("Noise smoothing must lie in (0, 1]");
  }
}

export class ImpactCaptureEngine {
  private readonly warmupSamples: number;
  private readonly preTriggerSamples: number;
  private readonly postTriggerSamples: number;
  private readonly preTriggerBuffer: Float32RingBuffer;
  private processedSamples = 0;
  private noiseRms = 0;
  private noisePeak = 0;
  private noiseInitialized = false;
  private captureBuffer: Float32Array | undefined;
  private captureWriteIndex = 0;
  private stateValue: CaptureState = "warming";

  constructor(
    readonly sampleRate: number,
    readonly config: CaptureConfig = DEFAULT_CAPTURE_CONFIG,
  ) {
    if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
      throw new RangeError(`Sample rate must be finite and positive; received ${sampleRate}`);
    }
    validateConfig(config);
    this.warmupSamples = millisecondsToSamples(config.warmupMs, sampleRate);
    this.preTriggerSamples = millisecondsToSamples(config.preTriggerMs, sampleRate);
    this.postTriggerSamples = millisecondsToSamples(config.postTriggerMs, sampleRate);
    this.preTriggerBuffer = new Float32RingBuffer(this.preTriggerSamples);
  }

  get state(): CaptureState {
    return this.stateValue;
  }

  reset(): void {
    this.processedSamples = 0;
    this.noiseRms = 0;
    this.noisePeak = 0;
    this.noiseInitialized = false;
    this.captureBuffer = undefined;
    this.captureWriteIndex = 0;
    this.stateValue = "warming";
    this.preTriggerBuffer.clear();
  }

  processBlock(samples: Float32Array): CaptureEngineEvent[] {
    if (samples.length === 0 || this.stateValue === "complete") return [];
    const events: CaptureEngineEvent[] = [];

    if (this.stateValue === "capturing") {
      const complete = this.appendCapture(samples);
      this.processedSamples += samples.length;
      if (complete !== undefined) events.push(complete);
      return events;
    }

    const metrics = measureBlock(samples);
    if (this.stateValue === "warming") {
      this.updateNoise(metrics.rms, metrics.peak);
      this.preTriggerBuffer.write(samples);
      this.processedSamples += samples.length;
      if (this.processedSamples >= this.warmupSamples) {
        this.stateValue = "armed";
        events.push({ type: "ARMED" });
      }
      return events;
    }

    if (!shouldTrigger(metrics, this.noiseRms, this.noisePeak, this.config)) {
      this.updateNoise(metrics.rms, metrics.peak);
      this.preTriggerBuffer.write(samples);
      this.processedSamples += samples.length;
      return events;
    }

    const triggerIndex = metrics.peakIndex;
    const ringSamplesNeeded = Math.max(0, this.preTriggerSamples - triggerIndex);
    const history = this.preTriggerBuffer.copyLast(ringSamplesNeeded);
    this.captureBuffer = new Float32Array(this.preTriggerSamples + this.postTriggerSamples);

    const historyOffset = this.preTriggerSamples - triggerIndex - history.length;
    this.captureBuffer.set(history, Math.max(0, historyOffset));
    const preInCurrent = Math.min(triggerIndex, this.preTriggerSamples);
    if (preInCurrent > 0) {
      this.captureBuffer.set(
        samples.subarray(triggerIndex - preInCurrent, triggerIndex),
        this.preTriggerSamples - preInCurrent,
      );
    }
    this.captureWriteIndex = this.preTriggerSamples;
    this.stateValue = "capturing";
    events.push({ type: "TRIGGERED", triggerSample: this.preTriggerSamples });
    const complete = this.appendCapture(samples.subarray(triggerIndex));
    this.processedSamples += samples.length;
    if (complete !== undefined) events.push(complete);
    return events;
  }

  private updateNoise(rms: number, peak: number): void {
    if (!this.noiseInitialized) {
      this.noiseRms = rms;
      this.noisePeak = peak;
      this.noiseInitialized = true;
      return;
    }
    const alpha = this.config.noiseSmoothing;
    this.noiseRms += alpha * (rms - this.noiseRms);
    this.noisePeak += alpha * (peak - this.noisePeak);
  }

  private appendCapture(samples: Float32Array): CaptureEngineEvent | undefined {
    const target = this.captureBuffer;
    if (target === undefined) throw new Error("Capture buffer is unavailable in capturing state");
    const remaining = target.length - this.captureWriteIndex;
    const count = Math.min(remaining, samples.length);
    if (count > 0) {
      target.set(samples.subarray(0, count), this.captureWriteIndex);
      this.captureWriteIndex += count;
    }
    if (this.captureWriteIndex < target.length) return undefined;
    this.stateValue = "complete";
    const capture: AudioCapture = {
      samples: target,
      sampleRate: this.sampleRate,
      triggerSample: this.preTriggerSamples,
    };
    return { type: "COMPLETE", capture };
  }
}
