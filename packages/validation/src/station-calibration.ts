import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  compareFingerprintToObjectModel,
  type AcousticObjectModelV1,
  type FingerprintToObjectModelComparisonV1,
} from "@everything-rings/fingerprint";
import { contentDigest } from "./provenance";

export interface StationCalibrationProtocolV1 {
  readonly schemaVersion: 1;
  readonly stationCalibrationContractVersion: "station-calibration-1";
  readonly protocolId: string;
  readonly createdAt: string;
  readonly referencePopulation: string;
  readonly referenceSpecimenId: string;
  readonly referenceObjectModelDigest: string;
  readonly referenceObjectModel: AcousticObjectModelV1;
  readonly minimumCoverage: number;
  readonly maximumMedianFrequencyDistanceCents: number;
  readonly minimumMatchedModes: number;
}

export async function createStationCalibrationProtocol(
  input: Omit<StationCalibrationProtocolV1, "schemaVersion" | "stationCalibrationContractVersion" | "protocolId" | "referenceObjectModelDigest">,
): Promise<StationCalibrationProtocolV1> {
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("station calibration createdAt is invalid");
  if (input.referencePopulation.trim().length === 0) throw new Error("station calibration referencePopulation is required");
  if (input.referenceSpecimenId.trim().toLocaleLowerCase("en-US") !== input.referenceObjectModel.specimenId.trim().toLocaleLowerCase("en-US")) {
    throw new Error("station calibration reference specimen does not match object model");
  }
  if (!(input.minimumCoverage > 0 && input.minimumCoverage <= 1)) throw new Error("minimumCoverage must be in (0,1]");
  if (!(input.maximumMedianFrequencyDistanceCents > 0) || !Number.isFinite(input.maximumMedianFrequencyDistanceCents)) {
    throw new Error("maximumMedianFrequencyDistanceCents must be finite and positive");
  }
  if (!Number.isInteger(input.minimumMatchedModes) || input.minimumMatchedModes <= 0) throw new Error("minimumMatchedModes must be a positive integer");
  const referenceObjectModelDigest = await contentDigest(input.referenceObjectModel);
  const payload = {
    ...input,
    schemaVersion: 1 as const,
    stationCalibrationContractVersion: "station-calibration-1" as const,
    referenceObjectModelDigest,
  };
  return { ...payload, protocolId: await contentDigest(payload) };
}

export async function verifyStationCalibrationProtocol(protocol: StationCalibrationProtocolV1): Promise<boolean> {
  if (protocol.schemaVersion !== 1 || protocol.stationCalibrationContractVersion !== "station-calibration-1") return false;
  if (!/^sha256:[0-9a-f]{64}$/.test(protocol.protocolId) || !/^sha256:[0-9a-f]{64}$/.test(protocol.referenceObjectModelDigest)) return false;
  if (!Number.isFinite(Date.parse(protocol.createdAt)) || protocol.referencePopulation.trim().length === 0) return false;
  if (protocol.referenceSpecimenId.trim().toLocaleLowerCase("en-US") !== protocol.referenceObjectModel.specimenId.trim().toLocaleLowerCase("en-US")) return false;
  if (!(protocol.minimumCoverage > 0 && protocol.minimumCoverage <= 1)) return false;
  if (!(protocol.maximumMedianFrequencyDistanceCents > 0) || !Number.isFinite(protocol.maximumMedianFrequencyDistanceCents)) return false;
  if (!Number.isInteger(protocol.minimumMatchedModes) || protocol.minimumMatchedModes <= 0) return false;
  if (protocol.referenceObjectModelDigest !== await contentDigest(protocol.referenceObjectModel)) return false;
  const { protocolId, ...payload } = protocol;
  return protocolId === await contentDigest(payload);
}

export interface StationCalibrationObservationV1 {
  readonly stationId: string;
  readonly createdAt: string;
  readonly specimenId: string;
  readonly fingerprint: AcousticFingerprintV1;
}

export interface StationCalibrationVerdictV1 {
  readonly schemaVersion: 1;
  readonly verdictContractVersion: "station-calibration-verdict-1";
  readonly protocolId: string;
  readonly stationId: string;
  readonly createdAt: string;
  readonly passed: boolean;
  readonly comparison: FingerprintToObjectModelComparisonV1;
  readonly reasons: readonly string[];
}

/** Diagnostic evaluator. Use evaluateVerifiedStationCalibration for authoritative station qualification. */
export function evaluateStationCalibration(
  protocol: StationCalibrationProtocolV1,
  observation: StationCalibrationObservationV1,
): StationCalibrationVerdictV1 {
  if (!Number.isFinite(Date.parse(observation.createdAt))) throw new Error("station calibration observation createdAt is invalid");
  if (observation.stationId.trim().length === 0) throw new Error("station calibration stationId is required");
  const reasons: string[] = [];
  if (observation.specimenId.trim().toLocaleLowerCase("en-US") !== protocol.referenceSpecimenId.trim().toLocaleLowerCase("en-US")) {
    reasons.push("observation specimen does not match the calibration reference specimen");
  }
  const comparison = compareFingerprintToObjectModel(observation.fingerprint, protocol.referenceObjectModel);
  if (comparison.coverage < protocol.minimumCoverage) reasons.push(`mode coverage ${comparison.coverage.toFixed(3)} is below ${protocol.minimumCoverage}`);
  if (comparison.matchedModelModes < protocol.minimumMatchedModes) reasons.push(`matched modes ${comparison.matchedModelModes} is below ${protocol.minimumMatchedModes}`);
  if (comparison.medianFrequencyDistanceCents === null || comparison.medianFrequencyDistanceCents > protocol.maximumMedianFrequencyDistanceCents) {
    reasons.push(`median modal drift exceeds ${protocol.maximumMedianFrequencyDistanceCents} cents`);
  }
  return {
    schemaVersion: 1,
    verdictContractVersion: "station-calibration-verdict-1",
    protocolId: protocol.protocolId,
    stationId: observation.stationId.trim(),
    createdAt: observation.createdAt,
    passed: reasons.length === 0,
    comparison,
    reasons,
  };
}

export async function evaluateVerifiedStationCalibration(
  protocol: StationCalibrationProtocolV1,
  observation: StationCalibrationObservationV1,
): Promise<StationCalibrationVerdictV1> {
  if (!await verifyStationCalibrationProtocol(protocol)) throw new Error("station calibration protocol failed content verification");
  return evaluateStationCalibration(protocol, observation);
}
