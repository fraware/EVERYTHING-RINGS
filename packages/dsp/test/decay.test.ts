import { describe, expect, it } from "vitest";

import { estimateTrackDecay } from "../src/decay/estimate";
import { fitRobustLine } from "../src/decay/robust-line";
import { summarizePeakTrack } from "../src/tracking/stability";
import type { PeakTrack } from "../src/tracking/tracks";

const DB_PER_NEPER = 20 / Math.LN10;

function decayingTrack(decaySeconds: number, withOutlier = false): PeakTrack {
  const frequencyHz = 997;
  return {
    id: 1,
    observations: Array.from({ length: 20 }, (_, frameIndex) => {
      const timeSeconds = frameIndex * 0.012;
      let magnitudeDb = -(DB_PER_NEPER * timeSeconds) / decaySeconds;
      if (withOutlier && frameIndex === 10) magnitudeDb += 12;
      return {
        frameIndex,
        timeSeconds,
        binIndex: 1,
        frequencyHz,
        magnitudeDb,
        prominenceDb: 20,
      };
    }),
  };
}

describe("fitRobustLine", () => {
  it("resists a large isolated outlier", () => {
    const x = Float64Array.from([0, 1, 2, 3, 4, 5, 6]);
    const y = Float64Array.from([1, 3, 5, 30, 9, 11, 13]);
    const fit = fitRobustLine(x, y);
    expect(fit.slope).toBeCloseTo(2, 1);
    expect(fit.intercept).toBeCloseTo(1, 1);
  });
});

describe("estimateTrackDecay", () => {
  it("recovers a known exponential decay despite a spectral outlier", () => {
    const track = decayingTrack(0.8, true);
    const result = estimateTrackDecay(track, summarizePeakTrack(track));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.abs(result.estimate.decaySeconds - 0.8) / 0.8).toBeLessThan(0.03);
    expect(result.estimate.q).toBeCloseTo(Math.PI * 997 * result.estimate.decaySeconds, 6);
  });

  it("rejects a non-decaying track", () => {
    const track = decayingTrack(0.8);
    const flatTrack: PeakTrack = {
      ...track,
      observations: track.observations.map((observation) => ({
        ...observation,
        magnitudeDb: 0,
      })),
    };
    expect(estimateTrackDecay(flatTrack, summarizePeakTrack(flatTrack))).toEqual({
      ok: false,
      reason: "NON_DECAYING",
    });
  });

  it("rejects a track with too few reliable tail observations", () => {
    const track = decayingTrack(0.8);
    const shortTail: PeakTrack = {
      ...track,
      observations: track.observations.map((observation, index) => ({
        ...observation,
        prominenceDb: index < 5 ? 20 : 3,
      })),
    };
    expect(estimateTrackDecay(shortTail, summarizePeakTrack(shortTail))).toEqual({
      ok: false,
      reason: "INSUFFICIENT_OBSERVATIONS",
    });
  });
});
