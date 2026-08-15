import { describe, expect, it } from "vitest";

import type { SpectralPeak } from "../src/peaks/detect";
import {
  DEFAULT_TRACK_ACCEPTANCE_CONFIG,
  isStablePeakTrack,
  summarizePeakTrack,
} from "../src/tracking/stability";
import { trackSpectralPeaks, type SpectralPeakFrame } from "../src/tracking/tracks";

function peak(frequencyHz: number, magnitudeDb = 0, prominenceDb = 20): SpectralPeak {
  return { binIndex: 1, frequencyHz, magnitudeDb, prominenceDb };
}

function frame(frameIndex: number, frequenciesHz: readonly number[]): SpectralPeakFrame {
  return {
    frameIndex,
    timeSeconds: frameIndex * 0.012,
    peaks: frequenciesHz.map((frequencyHz) => peak(frequencyHz)),
  };
}

describe("trackSpectralPeaks", () => {
  it("keeps stable nearby observations on one track", () => {
    const frames = Array.from({ length: 10 }, (_, frameIndex) =>
      frame(frameIndex, [997 + (frameIndex % 2 === 0 ? 0.3 : -0.2)]),
    );
    const tracks = trackSpectralPeaks(frames);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.observations).toHaveLength(10);
    const summary = summarizePeakTrack(tracks[0]!);
    expect(Math.abs(summary.frequencyHz - 997)).toBeLessThan(0.5);
    expect(isStablePeakTrack(summary, DEFAULT_TRACK_ACCEPTANCE_CONFIG)).toBe(true);
  });

  it("keeps two separated resonances on separate tracks", () => {
    const frames = Array.from({ length: 10 }, (_, frameIndex) => frame(frameIndex, [997, 2413]));
    const tracks = trackSpectralPeaks(frames);
    expect(tracks).toHaveLength(2);
    const frequencies = tracks.map((track) => summarizePeakTrack(track).frequencyHz).sort((a, b) => a - b);
    expect(frequencies[0]).toBeCloseTo(997, 6);
    expect(frequencies[1]).toBeCloseTo(2413, 6);
  });

  it("bridges up to two missing frames", () => {
    const tracks = trackSpectralPeaks([
      frame(0, [997]),
      frame(1, [997]),
      frame(2, []),
      frame(3, []),
      frame(4, [998]),
    ]);
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.observations).toHaveLength(3);
  });

  it("starts a new track after a gap exceeds the configured allowance", () => {
    const tracks = trackSpectralPeaks([
      frame(0, [997]),
      frame(1, [997]),
      frame(2, []),
      frame(3, []),
      frame(4, []),
      frame(5, [997]),
    ]);
    expect(tracks).toHaveLength(2);
  });

  it("starts a new track for a frequency jump outside association tolerance", () => {
    expect(trackSpectralPeaks([frame(0, [997]), frame(1, [1100])])).toHaveLength(2);
  });
});
