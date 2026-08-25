import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { describe, expect, it } from "vitest";
import {
  CONSUMER_HISTORY_STORAGE_KEY,
  MAX_CONSUMER_HISTORY_RECORDS,
  clearConsumerHistory,
  createConsumerCaptureRecord,
  loadConsumerHistory,
  persistConsumerHistory,
  prependConsumerCapture,
  removeConsumerCapture,
  type ConsumerHistoryStorage,
} from "./consumerHistory";

const FINGERPRINT: AcousticFingerprintV1 = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 1.5,
  modes: [
    {
      frequencyHz: 440,
      relativeAmplitude: 1,
      decaySeconds: 1.2,
      q: 120,
      confidence: 0.9,
      diagnostics: {
        prominenceDb: 18,
        persistenceSeconds: 0.9,
        frequencyStdCents: 4,
        decayFitScore: 0.92,
        observationCount: 12,
      },
    },
    {
      frequencyHz: 880,
      relativeAmplitude: 0.45,
      decaySeconds: 0.7,
      q: 90,
      confidence: 0.82,
      diagnostics: {
        prominenceDb: 12,
        persistenceSeconds: 0.6,
        frequencyStdCents: 7,
        decayFitScore: 0.86,
        observationCount: 10,
      },
    },
  ],
};

class MemoryStorage implements ConsumerHistoryStorage {
  private value: string | null = null;
  failWrites = false;

  getItem(key: string): string | null {
    return key === CONSUMER_HISTORY_STORAGE_KEY ? this.value : null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException("quota", "QuotaExceededError");
    if (key === CONSUMER_HISTORY_STORAGE_KEY) this.value = value;
  }

  removeItem(key: string): void {
    if (this.failWrites) throw new DOMException("blocked", "SecurityError");
    if (key === CONSUMER_HISTORY_STORAGE_KEY) this.value = null;
  }

  seed(value: string): void {
    this.value = value;
  }
}

function record(index: number) {
  return createConsumerCaptureRecord(
    {
      ...FINGERPRINT,
      modes: FINGERPRINT.modes.map((mode, modeIndex) => ({
        ...mode,
        frequencyHz: mode.frequencyHz + index * 3 + modeIndex,
      })),
    },
    new Date(Date.UTC(2026, 7, 18, 12, 0, index)).toISOString(),
    "60fe9913e6c0d90719c85028ee279942f35996d3",
  );
}

describe("consumer capture history", () => {
  it("round-trips fingerprint-only records with provenance", () => {
    const storage = new MemoryStorage();
    const entry = record(1);
    expect(persistConsumerHistory(storage, [entry])).toBe(true);
    expect(loadConsumerHistory(storage)).toEqual([entry]);
    expect(JSON.stringify(loadConsumerHistory(storage))).not.toContain("samples");
    expect(entry.softwareRevision).toBe("60fe9913e6c0d90719c85028ee279942f35996d3");
    expect(entry.fingerprint.algorithmVersion).toBe("er-dsp-2");
  });

  it("caps history and keeps newest captures first", () => {
    let records = [] as ReturnType<typeof loadConsumerHistory>;
    for (let index = 0; index < MAX_CONSUMER_HISTORY_RECORDS + 5; index += 1) {
      records = prependConsumerCapture(records, record(index));
    }
    expect(records).toHaveLength(MAX_CONSUMER_HISTORY_RECORDS);
    expect(records[0]?.id).toBe(record(MAX_CONSUMER_HISTORY_RECORDS + 4).id);
  });

  it("removes one capture without conflating equal physical objects", () => {
    const first = record(1);
    const second = record(2);
    const remaining = removeConsumerCapture([first, second], first.id);
    expect(remaining).toEqual([second]);
  });

  it("clears persisted history", () => {
    const storage = new MemoryStorage();
    expect(persistConsumerHistory(storage, [record(1)])).toBe(true);
    expect(clearConsumerHistory(storage)).toBe(true);
    expect(loadConsumerHistory(storage)).toEqual([]);
  });

  it("fails closed on malformed or forged storage", () => {
    const storage = new MemoryStorage();
    storage.seed("{malformed");
    expect(loadConsumerHistory(storage)).toEqual([]);

    const forged = record(1);
    storage.seed(JSON.stringify({
      schemaVersion: 1,
      records: [{ ...forged, signature: "er1-0000000000000000" }],
    }));
    expect(loadConsumerHistory(storage)).toEqual([]);
  });

  it("keeps storage failures out of the capture path", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    expect(persistConsumerHistory(storage, [record(1)])).toBe(false);
    expect(clearConsumerHistory(storage)).toBe(false);
  });

  it("records an unstamped build without inventing provenance", () => {
    const entry = createConsumerCaptureRecord(
      FINGERPRINT,
      "2026-08-18T12:00:00.000Z",
      "dev",
    );
    expect(entry.softwareRevision).toBeNull();
  });
});
