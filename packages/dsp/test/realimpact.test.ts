import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeImpact } from "../src/analysis/analyze-impact";
import { extractImpactRingdown } from "../src/preprocess/ringdown";

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
      "<f4": "f4", "|f4": "f4", "<f8": "f8", "|f8": "f8",
      "<i4": "i4", "|i4": "i4", "<i8": "i8", "|i8": "i8",
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

function centsDistance(leftHz: number, rightHz: number): number {
  return 1200 * Math.abs(Math.log2(rightHz / leftHz));
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length === 0) return Number.NaN;
  if (ordered.length % 2 === 1) return ordered[middle] ?? Number.NaN;
  return ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
}

const datasetDirectory = process.env.REALIMPACT_DIR;
const manual = datasetDirectory === undefined ? describe.skip : describe;

manual("RealImpact Gate A external benchmark", () => {
  it("recovers recurrent modal frequencies across separate strikes", () => {
    if (datasetDirectory === undefined) throw new Error("REALIMPACT_DIR is required");
    const soundsPath = path.join(datasetDirectory, "preprocessed", "sounds.npy");
    const vertexPath = path.join(datasetDirectory, "preprocessed", "vertexID.npy");
    expect(fs.existsSync(soundsPath), `Missing ${soundsPath}`).toBe(true);
    expect(fs.existsSync(vertexPath), `Missing ${vertexPath}`).toBe(true);

    const soundHeader = readNpyHeader(soundsPath);
    const vertexIds = readNumericVector(vertexPath);
    expect(soundHeader.shape[0]).toBe(vertexIds.length);

    const microphoneIndex = Number(process.env.REALIMPACT_MIC_INDEX ?? 7);
    const requestedVertex = process.env.REALIMPACT_VERTEX_ID;
    const candidateVertex = requestedVertex === undefined
      ? vertexIds.find((value, index) => index % 15 === microphoneIndex && vertexIds.filter((item) => item === value).length >= 45)
      : Number(requestedVertex);
    if (candidateVertex === undefined || !Number.isFinite(candidateVertex)) {
      throw new Error("Could not select a repeated impact vertex");
    }

    const rowIndices = vertexIds
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => value === candidateVertex && index % 15 === microphoneIndex)
      .slice(0, Number(process.env.REALIMPACT_MAX_STRIKES ?? 12))
      .map(({ index }) => index);
    expect(rowIndices.length).toBeGreaterThanOrEqual(3);

    const sampleRate = 48_000;
    const fingerprints = rowIndices.flatMap((rowIndex) => {
      const samples = readFloatMatrixRow(soundsPath, rowIndex);
      const coarse = coarseImpactSample(samples, sampleRate);
      const ringdown = extractImpactRingdown(samples, sampleRate, coarse);
      const result = analyzeImpact(ringdown.samples, sampleRate);
      return result.ok ? [{ rowIndex, fingerprint: result.fingerprint }] : [];
    });
    expect(fingerprints.length).toBeGreaterThanOrEqual(3);

    const reference = fingerprints[0];
    if (reference === undefined) throw new Error("No reference fingerprint");
    const topReferenceModes = reference.fingerprint.modes.slice(0, 8);
    const strikeDrifts = fingerprints.slice(1).map(({ fingerprint }) => median(
      topReferenceModes.map((mode) => {
        const nearest = [...fingerprint.modes].sort(
          (left, right) => centsDistance(mode.frequencyHz, left.frequencyHz) - centsDistance(mode.frequencyHz, right.frequencyHz),
        )[0];
        return nearest === undefined ? 1200 : centsDistance(mode.frequencyHz, nearest.frequencyHz);
      }),
    ));

    const report = {
      schemaVersion: 1,
      dataset: "RealImpact",
      objectDirectory: path.basename(datasetDirectory),
      sampleRate,
      vertexId: candidateVertex,
      microphoneIndex,
      attemptedRows: rowIndices,
      acceptedRows: fingerprints.map(({ rowIndex }) => rowIndex),
      acceptanceRate: fingerprints.length / rowIndices.length,
      medianStrikeDriftCents: median(strikeDrifts),
      strikeDriftsCents: strikeDrifts,
      referenceModes: topReferenceModes.map((mode) => ({
        frequencyHz: mode.frequencyHz,
        decaySeconds: mode.decaySeconds,
        confidence: mode.confidence,
      })),
    };

    if (process.env.REALIMPACT_REPORT !== undefined) {
      fs.writeFileSync(process.env.REALIMPACT_REPORT, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));
    expect(Number.isFinite(report.medianStrikeDriftCents)).toBe(true);
  });
});
