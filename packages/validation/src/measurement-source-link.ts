import { contentDigest, isContentDigest } from "./provenance";

export const MEASUREMENT_SOURCE_LINK_CONTRACT_VERSION = "measurement-source-link-1" as const;

const GIT_REVISION = /^[0-9a-f]{40}$/;

export interface MeasurementSourceLinkV1 {
  readonly schemaVersion: 1;
  readonly sourceLinkContractVersion: "measurement-source-link-1";
  readonly sourceLinkId: string;
  readonly measurementId: string;
  readonly originalFilename: string;
  readonly sourceByteDigest: string;
  readonly sourceContractVersion: string;
  readonly sourceRevision: string;
  readonly conversionToolRevision: string;
  readonly createdAt: string;
}

function assertOriginalFilename(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.length === 0) throw new Error("source-link originalFilename is required");
  if (trimmed.includes("\0") || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new Error("source-link originalFilename must be a basename without path separators");
  }
  return trimmed;
}

export async function createMeasurementSourceLink(
  input: Omit<MeasurementSourceLinkV1, "schemaVersion" | "sourceLinkContractVersion" | "sourceLinkId">,
): Promise<MeasurementSourceLinkV1> {
  if (!isContentDigest(input.measurementId)) throw new Error("source-link measurementId must be a measurement content digest");
  if (!isContentDigest(input.sourceByteDigest)) throw new Error("source-link sourceByteDigest must be the SHA-256 of the exact source bytes");
  const originalFilename = assertOriginalFilename(input.originalFilename);
  if (input.sourceContractVersion.trim().length === 0) throw new Error("source-link sourceContractVersion is required");
  if (!GIT_REVISION.test(input.sourceRevision)) throw new Error("source-link sourceRevision must be exact 40-hex Git revision");
  if (!GIT_REVISION.test(input.conversionToolRevision)) throw new Error("source-link conversionToolRevision must be exact 40-hex Git revision");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("source-link createdAt is invalid");
  const payload = {
    conversionToolRevision: input.conversionToolRevision,
    createdAt: input.createdAt,
    measurementId: input.measurementId,
    originalFilename,
    schemaVersion: 1 as const,
    sourceByteDigest: input.sourceByteDigest,
    sourceContractVersion: input.sourceContractVersion.trim(),
    sourceLinkContractVersion: MEASUREMENT_SOURCE_LINK_CONTRACT_VERSION,
    sourceRevision: input.sourceRevision,
  };
  return { ...payload, sourceLinkId: await contentDigest(payload) };
}

export async function verifyMeasurementSourceLink(link: MeasurementSourceLinkV1): Promise<boolean> {
  if (link.schemaVersion !== 1 || link.sourceLinkContractVersion !== MEASUREMENT_SOURCE_LINK_CONTRACT_VERSION) return false;
  if (!isContentDigest(link.sourceLinkId) || !isContentDigest(link.measurementId) || !isContentDigest(link.sourceByteDigest)) return false;
  try {
    assertOriginalFilename(link.originalFilename);
  } catch {
    return false;
  }
  if (link.sourceContractVersion.trim().length === 0) return false;
  if (!GIT_REVISION.test(link.sourceRevision) || !GIT_REVISION.test(link.conversionToolRevision)) return false;
  if (!Number.isFinite(Date.parse(link.createdAt))) return false;
  const { sourceLinkId, ...payload } = link;
  return sourceLinkId === await contentDigest(payload);
}
