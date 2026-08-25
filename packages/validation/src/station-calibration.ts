import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  compareFingerprintToObjectModel,
  type AcousticObjectModelV1,
  type FingerprintToObjectModelComparisonV1,
} from "@everything-rings/fingerprint";
import type { CaptureSettingsEvidence, FixedSetupProtocol } from "./types";
import { contentDigest, isContentDigest } from "./provenance";

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

export type StationQualificationStatus = "qualified" | "unqualified" | "unknown" | "expired";

export const STATION_QUALIFICATION_STATUSES = ["qualified", "unqualified", "unknown", "expired"] as const;
export const STATION_QUALIFICATION_CONTRACT_VERSION = "station-qualification-1" as const;
export const STATION_QUALIFICATION_SCOPED_QUESTION = "reference-object-modal-structure" as const;

export interface StationCalibrationObservationV1 {
  readonly stationId: string;
  readonly createdAt: string;
  readonly specimenId: string;
  readonly fingerprint: AcousticFingerprintV1;
  readonly status?: StationQualificationStatus;
}

export interface StationCalibrationVerdictV1 {
  readonly schemaVersion: 1;
  readonly verdictContractVersion: "station-calibration-verdict-1";
  readonly protocolId: string;
  readonly stationId: string;
  readonly createdAt: string;
  readonly passed: boolean;
  readonly stationStatus: StationQualificationStatus;
  readonly comparison: FingerprintToObjectModelComparisonV1;
  readonly reasons: readonly string[];
}

export interface ObservationStationProvenanceV1 {
  readonly stationId: string;
  readonly status: StationQualificationStatus;
  readonly qualificationId: string | null;
}

export interface StationQualificationObservationV1 {
  readonly observationId: string;
  readonly createdAt: string;
  readonly specimenId: string;
  readonly measurementId: string | null;
  readonly coverage: number;
  readonly medianFrequencyDistanceCents: number | null;
  readonly matchedModes: number;
  readonly status: StationQualificationStatus;
}

export interface StationQualificationRecordV1 {
  readonly schemaVersion: 1;
  readonly stationQualificationContractVersion: "station-qualification-1";
  readonly qualificationId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly stationId: string;
  readonly deviceDescription: string;
  readonly microphoneDescription: string | null;
  readonly operatingSystem: string;
  readonly runtime: string;
  readonly captureSettings: CaptureSettingsEvidence | null;
  readonly referenceObjectModelId: string;
  readonly setup: FixedSetupProtocol;
  readonly setupContractVersion: string;
  readonly protocolDigest: string;
  readonly observations: readonly StationQualificationObservationV1[];
  readonly coverage: number;
  readonly medianFrequencyDistanceCents: number | null;
  readonly verdict: "pass" | "open";
  readonly scopedQuestion: "reference-object-modal-structure";
  readonly calibratesAbsoluteLoudness: false;
  readonly assertsGlobalDeviceEquivalence: false;
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
    stationStatus: reasons.length === 0 ? "qualified" : "unqualified",
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

export function resolveObservationStationStatus(args: {
  readonly storedStatus: StationQualificationStatus | undefined;
  readonly qualificationExpiresAt: string | null;
  readonly at: string;
}): StationQualificationStatus {
  const stored = args.storedStatus ?? "unknown";
  if (args.qualificationExpiresAt === null) return stored;
  const at = Date.parse(args.at);
  const expires = Date.parse(args.qualificationExpiresAt);
  if (!Number.isFinite(at) || !Number.isFinite(expires)) return stored;
  if (at > expires && stored === "qualified") return "expired";
  return stored;
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${field} is required`);
  return trimmed;
}

export async function createStationQualificationRecord(input: {
  readonly protocol: StationCalibrationProtocolV1;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly stationId: string;
  readonly deviceDescription: string;
  readonly microphoneDescription: string | null;
  readonly operatingSystem: string;
  readonly runtime: string;
  readonly captureSettings: CaptureSettingsEvidence | null;
  readonly setup: FixedSetupProtocol;
  readonly setupContractVersion: string;
  readonly observations: readonly (StationCalibrationObservationV1 & {
    readonly observationId: string;
    readonly measurementId: string | null;
  })[];
}): Promise<StationQualificationRecordV1> {
  if (!await verifyStationCalibrationProtocol(input.protocol)) {
    throw new Error("station qualification protocol failed content verification");
  }
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("station qualification createdAt is invalid");
  if (!Number.isFinite(Date.parse(input.expiresAt))) throw new Error("station qualification expiresAt is invalid");
  if (Date.parse(input.expiresAt) <= Date.parse(input.createdAt)) throw new Error("station qualification expiresAt must be after createdAt");
  if (input.observations.length === 0) throw new Error("station qualification requires observations");
  const stationId = requiredText(input.stationId, "stationId");
  const seen = new Set<string>();
  const observations: StationQualificationObservationV1[] = [];
  for (const observation of input.observations) {
    const observationId = requiredText(observation.observationId, "observationId");
    if (seen.has(observationId)) throw new Error(`duplicate station qualification observation ${observationId}`);
    seen.add(observationId);
    if (observation.stationId.trim() !== stationId) throw new Error("qualification observation stationId mismatch");
    if (observation.measurementId !== null && !isContentDigest(observation.measurementId)) {
      throw new Error("qualification measurementId must be a content digest when present");
    }
    const verdict = evaluateStationCalibration(input.protocol, observation);
    observations.push({
      observationId,
      createdAt: observation.createdAt,
      specimenId: observation.specimenId,
      measurementId: observation.measurementId,
      coverage: verdict.comparison.coverage,
      medianFrequencyDistanceCents: verdict.comparison.medianFrequencyDistanceCents,
      matchedModes: verdict.comparison.matchedModelModes,
      status: verdict.stationStatus,
    });
  }
  const ordered = [...observations].sort((left, right) => left.observationId.localeCompare(right.observationId, "en-US"));
  const coverages = ordered.map((observation) => observation.coverage);
  const drifts = ordered
    .map((observation) => observation.medianFrequencyDistanceCents)
    .filter((value): value is number => value !== null);
  const coverage = coverages.reduce((sum, value) => sum + value, 0) / coverages.length;
  const medianFrequencyDistanceCents = drifts.length === 0
    ? null
    : [...drifts].sort((left, right) => left - right)[Math.floor((drifts.length - 1) / 2)] ?? null;
  const payload = {
    assertsGlobalDeviceEquivalence: false as const,
    calibratesAbsoluteLoudness: false as const,
    captureSettings: input.captureSettings,
    coverage,
    createdAt: input.createdAt,
    deviceDescription: requiredText(input.deviceDescription, "deviceDescription"),
    expiresAt: input.expiresAt,
    medianFrequencyDistanceCents,
    microphoneDescription: input.microphoneDescription,
    observations: ordered,
    operatingSystem: requiredText(input.operatingSystem, "operatingSystem"),
    protocolDigest: input.protocol.protocolId,
    referenceObjectModelId: input.protocol.referenceObjectModelDigest,
    runtime: requiredText(input.runtime, "runtime"),
    schemaVersion: 1 as const,
    scopedQuestion: STATION_QUALIFICATION_SCOPED_QUESTION,
    setup: input.setup,
    setupContractVersion: requiredText(input.setupContractVersion, "setupContractVersion"),
    stationId,
    stationQualificationContractVersion: STATION_QUALIFICATION_CONTRACT_VERSION,
    verdict: ordered.every((observation) => observation.status === "qualified") ? "pass" as const : "open" as const,
  };
  return { ...payload, qualificationId: await contentDigest(payload) };
}

export async function verifyStationQualificationRecord(record: StationQualificationRecordV1): Promise<boolean> {
  if (record.schemaVersion !== 1 || record.stationQualificationContractVersion !== STATION_QUALIFICATION_CONTRACT_VERSION) return false;
  if (record.scopedQuestion !== STATION_QUALIFICATION_SCOPED_QUESTION) return false;
  if (record.calibratesAbsoluteLoudness !== false || record.assertsGlobalDeviceEquivalence !== false) return false;
  if (!isContentDigest(record.qualificationId) || !isContentDigest(record.protocolDigest) || !isContentDigest(record.referenceObjectModelId)) return false;
  if (!Number.isFinite(Date.parse(record.createdAt)) || !Number.isFinite(Date.parse(record.expiresAt))) return false;
  if (record.observations.length === 0) return false;
  if (record.verdict !== "pass" && record.verdict !== "open") return false;
  const { qualificationId, ...payload } = record;
  return qualificationId === await contentDigest(payload);
}

export function stationQualificationStatusAt(
  record: StationQualificationRecordV1,
  at: string,
): StationQualificationStatus {
  if (record.verdict !== "pass") {
    return resolveObservationStationStatus({
      storedStatus: "unqualified",
      qualificationExpiresAt: record.expiresAt,
      at,
    });
  }
  return resolveObservationStationStatus({
    storedStatus: "qualified",
    qualificationExpiresAt: record.expiresAt,
    at,
  });
}
