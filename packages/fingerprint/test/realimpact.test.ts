import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeImpact, extractImpactRingdown } from "@everything-rings/dsp";
import { fingerprintRecurrence } from "../src/recurrence";

interface NpyHeader {
  readonly dataOffset: number;
  readonly dtype: "f4" | "f8" | "i4" | "i8";
  readonly shape: readonly number[];
  readonly bytesPerElement: number;
}

function readNpyHeader(filePath: string): NpyHeader {
  const fd = fs.openSync(filePath, "r");
  try {
    const prefix = Buffer.alloc(65_536);
    const bytesRead = fs.readSync(fd, prefix, 0, prefix.length, 0);
    if (bytesRead < 12 || prefix[0] !== 0x93 || prefix.subarray(1, 6).toString("ascii") !== "NUMPY") {
      throw new Error(`${filePath} is not a NumPy .npy file`);
    }
    const major = prefix[6] ?? 0;
    const headerLength = major === 1 ? prefix.readUInt16LE(8) : prefix.readUInt32LE(8);
    const headerStart = major === 1 ? 10 : 12;
    const header = prefix.subarray(headerStart, headerStart + headerLength).toString("latin1");
    const descr = /['\"]descr['\"]\s*:\s*['\"]([^'\"]+)['\"]/.exec(header)?.[1];
    const fortran = /['\"]fortran_order['\"]\s*:\s*(True|False)/.exec(header)?.[1];
    const shapeText = /['\"]shape['\"]\s*:\s*\(([^)]*)\)/.exec(header)?.[1];
    if (descr === undefined || fortran === undefined || shapeText === undefined) {
      throw new Error(`Unsupported NumPy header in ${filePath}`);
    }
    if (fortran === "True") throw new Error("Fortran-ordered arrays are unsupported");
    const dtypeMap: Record<string, NpyHeader["dtype"] | undefined> = {
      "<f4": "f4",
      "|f4": "f4",
      "<f8": "f8",
      "|f8": "f8",
      "<i4": "i4",
      "|i4": "i4",
      "<i8": "i8",
      "|i8": "i8",
    };
    const dtype = dtypeMap[descr];
    if (dtype === undefined) throw new Error(`Unsupported NumPy dtype ${descr}`);
    const shape = shapeText.split(",").map((value) => value.trim()).filter(Boolean).map(Number);
    if (shape.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new Error(`Invalid NumPy shape ${shapeText}`);
    }
    return {
      dataOffset: headerStart + headerLength,
      dtype,
      shape,
      bytesPerElement: dtype === "f8" || dtype === "i8" ? 8 : 4,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function readNumericVector(filePath: string): number[] {
  const header = readNpyHeader(filePath);
  if (header.shape.length !== 1) throw new Error(`${filePath} must be one-dimensional`);
  const count = header.shape[0] ?? 0;
  const buffer = Buffer.alloc(count * header.bytesPerElement);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, buffer.length, header.dataOffset);
  } finally {
    fs.closeSync(fd);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return Array.from({ length: count }, (_, index) => {
    const offset = index * header.bytesPerElement;
    if (header.dtype === "f4") return view.getFloat32(offset, true);
    if (header.dtype === "f8") return view.getFloat64(offset, true);
    if (header.dtype === "i4") return view.getInt32(offset, true);
    return Number(view.getBigInt64(offset, true));
  });
}

function readFloatMatrixRow(filePath: string, rowIndex: number): Float32Array {
  const header = readNpyHeader(filePath);
  if (header.shape.length !== 2 || (header.dtype !== "f4" && header.dtype !== "f8")) {
    throw new Error(`${filePath} must be a two-dimensional floating-point array`);
  }
  const rows = header.shape[0] ?? 0;
  const columns = header.shape[1] ?? 0;
  if (rowIndex < 0 || rowIndex >= rows) throw new RangeError(`Row ${rowIndex} is out of range`);
  const byteLength = columns * header.bytesPerElement;
  const buffer = Buffer.alloc(byteLength);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, byteLength, header.dataOffset + rowIndex * byteLength);
  } finally {
    fs.closeSync(fd);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const output = new Float32Array(columns);
  for (let index = 0; index < columns; index += 1) {
    const offset = index * header.bytesPerElement;
    output[index] = header.dtype === "f4" ? view.getFloat32(offset, true) : view.getFloat64(offset, true);
  }
  return output;
}

function coarseImpactSample(samples: Float32Array, sampleRate: number): number {
  const window = Math.max(8, Math.round(0.0015 * sampleRate));
  const prefix = new Float64Array(samples.length + 1);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index] ?? 0;
    prefix[index + 1] = (prefix[index] ?? 0) + value * value;
  }
  let bestIndex = window;
  let bestRise = Number.NEGATIVE_INFINITY;
  for (let index = window; index + window < samples.length; index += 1) {
    const before = ((prefix[index] ?? 0) - (prefix[index - window] ?? 0)) / window;
    const after = ((prefix[index + window] ?? 0) - (prefix[index] ?? 0)) / window;
    const rise = after - before;
    if (rise > bestRise) {
      bestRise = rise;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle] ?? Number.NaN;
  return ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
}

function selectRepeatedVertex(vertexIds: readonly number[], micIds: readonly number[], microphoneId: number): number | undefined {
  const counts = new Map<number, number>();
  for (let index = 0; index < vertexIds.length; index += 1) {
    if (micIds[index] !== microphoneId) continue;
    const vertexId = vertexIds[index];
    if (vertexId === undefined) continue;
    counts.set(vertexId, (counts.get(vertexId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

const datasetDirectory = process.env.REALIMPACT_DIR;
const manual = datasetDirectory === undefined ? describe.skip : describe;

manual("RealImpact cross-field recurrence benchmark", () => {
  it("recovers modal frequencies across separate listener positions", () => {
    if (datasetDirectory === undefined) throw new Error("REALIMPACT_DIR is required");
    const preprocessed = path.join(datasetDirectory, "preprocessed");
    const responsePath = path.join(preprocessed, "deconvolved_0db.npy");
    const vertexPath = path.join(preprocessed, "vertexID.npy");
    const microphonePath = path.join(preprocessed, "micID.npy");
    expect(fs.existsSync(responsePath), `Missing ${responsePath}`).toBe(true);
    expect(fs.existsSync(vertexPath), `Missing ${vertexPath}`).toBe(true);
    expect(fs.existsSync(microphonePath), `Missing ${microphonePath}`).toBe(true);

    const responseHeader = readNpyHeader(responsePath);
    const vertexIds = readNumericVector(vertexPath);
    const microphoneIds = readNumericVector(microphonePath);
    const rowCount = responseHeader.shape[0] ?? 0;
    expect(rowCount).toBe(vertexIds.length);
    expect(rowCount).toBe(microphoneIds.length);

    const microphoneId = Number(process.env.REALIMPACT_MIC_ID ?? 7);
    const requestedVertex = process.env.REALIMPACT_VERTEX_ID;
    const vertexId = requestedVertex === undefined
      ? selectRepeatedVertex(vertexIds, microphoneIds, microphoneId)
      : Number(requestedVertex);
    if (vertexId === undefined || !Number.isFinite(vertexId)) {
      throw new Error("Could not select a repeated impact vertex");
    }

    const maximumMeasurements = Number(process.env.REALIMPACT_MAX_MEASUREMENTS ?? 8);
    const rowIndices = vertexIds
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => value === vertexId && microphoneIds[index] === microphoneId)
      .slice(0, maximumMeasurements)
      .map(({ index }) => index);
    expect(rowIndices.length).toBeGreaterThanOrEqual(3);

    const sampleRate = 48_000;
    const attempts = rowIndices.map((rowIndex, measurementOrdinal) => {
      const response = readFloatMatrixRow(responsePath, rowIndex);
      const coarse = coarseImpactSample(response, sampleRate);
      const ringdown = extractImpactRingdown(response, sampleRate, coarse);
      const result = analyzeImpact(ringdown.samples, sampleRate);
      return { rowIndex, measurementOrdinal, coarseImpactSample: coarse, ringdownStartSample: ringdown.startSample, result };
    });
    const fingerprints = attempts.flatMap(({ rowIndex, measurementOrdinal, result }) =>
      result.ok ? [{ rowIndex, measurementOrdinal, fingerprint: result.fingerprint }] : [],
    );

    const reference = fingerprints[0];
    const comparisons = reference === undefined ? [] : fingerprints.slice(1).map(({ rowIndex, measurementOrdinal, fingerprint }) => ({
      rowIndex,
      measurementOrdinal,
      recurrence: fingerprintRecurrence(reference.fingerprint, fingerprint),
    }));
    const measurementDrifts = comparisons.map(({ recurrence }) => recurrence.medianCents);

    const report = {
      schemaVersion: 4,
      dataset: "RealImpact",
      validationScope: "cross-field-modal-recurrence",
      releaseGateEquivalent: false,
      signal: "deconvolved_0db",
      objectDirectory: path.basename(datasetDirectory),
      sampleRate,
      vertexId,
      microphoneId,
      attemptedRows: rowIndices,
      attempts: attempts.map(({ rowIndex, measurementOrdinal, coarseImpactSample, ringdownStartSample, result }) =>
        result.ok
          ? { rowIndex, measurementOrdinal, coarseImpactSample, ringdownStartSample, ok: true, modeCount: result.fingerprint.modes.length }
          : { rowIndex, measurementOrdinal, coarseImpactSample, ringdownStartSample, ok: false, reason: result.reason },
      ),
      acceptedRows: fingerprints.map(({ rowIndex }) => rowIndex),
      acceptanceRate: fingerprints.length / rowIndices.length,
      medianCrossFieldDriftCents: median(measurementDrifts),
      crossFieldDriftsCents: measurementDrifts,
      comparisons: comparisons.map(({ rowIndex, measurementOrdinal, recurrence }) => ({
        rowIndex,
        measurementOrdinal,
        medianCents: recurrence.medianCents,
        meanCents: recurrence.meanCents,
        matchedCount: recurrence.matchedCount,
        unmatchedReferenceCount: recurrence.unmatchedReferenceCount,
      })),
      referenceModes: reference?.fingerprint.modes.slice(0, 8).map((mode) => ({
        frequencyHz: mode.frequencyHz,
        decaySeconds: mode.decaySeconds,
        confidence: mode.confidence,
      })) ?? [],
    };

    if (process.env.REALIMPACT_REPORT !== undefined) {
      fs.writeFileSync(process.env.REALIMPACT_REPORT, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));

    expect(fingerprints.length).toBeGreaterThanOrEqual(3);
    expect(Number.isFinite(report.medianCrossFieldDriftCents)).toBe(true);
  }, 30_000);
});
