import { access, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  createMeasurementRecord,
  createMeasurementSourceLink,
  createResearchBenchmarkSnapshot,
  parseValidationEvidenceJson,
  verifyDerivationRecord,
  verifyDerivationRecordV2,
  verifyMeasurementRecord,
  verifyMeasurementSourceLink,
  verifyResearchBenchmarkSnapshot,
  verifyResearchRepositoryIntegrity,
  type MeasurementRecordV1,
  type ResearchBenchmarkSnapshotV1,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";
import { flagPresent, flagString } from "./flags.ts";
import {
  indexDerivation,
  indexFromUnknownGraph,
  indexMeasurement,
  indexSnapshot,
  isDerivationRecordV1,
  isDerivationRecordV2,
  isMeasurementRecord,
  isResearchBenchmarkSnapshot,
  isResearchRepository,
  walkLineage,
  type LineageGraphIndex,
} from "./lineage.ts";
import {
  FAILURE_EXIT,
  SUCCESS_EXIT,
  type Io,
  writeJson,
} from "./report.ts";
import { parseSourceJson, readSourceFile, sourceIntegrityFields } from "./source-file.ts";

export async function hashCommand(path: string, io: Io): Promise<number> {
  const source = await readSourceFile(path);
  writeJson(io, {
    ok: true,
    command: "hash",
    ...sourceIntegrityFields(source),
  });
  return SUCCESS_EXIT;
}

export async function verifyEvidenceCommand(path: string, io: Io): Promise<number> {
  const source = await readSourceFile(path);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
  } catch {
    writeJson(io, {
      ok: false,
      command: "verify-evidence",
      ...sourceIntegrityFields(source),
      error: "file is not valid UTF-8",
    });
    return FAILURE_EXIT;
  }
  const parsed = parseValidationEvidenceJson(text);
  if (!parsed.ok) {
    writeJson(io, {
      ok: false,
      command: "verify-evidence",
      ...sourceIntegrityFields(source),
      schemaVersion: readNumericField(text, "schemaVersion"),
      error: parsed.error,
    });
    return FAILURE_EXIT;
  }
  writeJson(io, {
    ok: true,
    command: "verify-evidence",
    ...sourceIntegrityFields(source),
    schemaVersion: parsed.evidence.schemaVersion,
    evidenceContractVersion: parsed.evidence.evidenceContractVersion,
    gateAContractVersion: parsed.evidence.gateAContractVersion,
    sessionId: parsed.evidence.sessionId,
    specimenId: parsed.evidence.object.specimenId,
    softwareRevision: parsed.evidence.softwareRevision,
  });
  return SUCCESS_EXIT;
}

export async function verifyMeasurementCommand(path: string, io: Io): Promise<number> {
  const source = await readSourceFile(path);
  const parsed = parseSourceJson(source.bytes);
  if (!parsed.ok) {
    writeJson(io, {
      ok: false,
      command: "verify-measurement",
      ...sourceIntegrityFields(source),
      error: parsed.error,
    });
    return FAILURE_EXIT;
  }
  if (!isMeasurementRecord(parsed.value)) {
    writeJson(io, {
      ok: false,
      command: "verify-measurement",
      ...sourceIntegrityFields(source),
      error: "not a measurement-record-1 object",
    });
    return FAILURE_EXIT;
  }
  const valid = await verifyMeasurementRecord(parsed.value);
  writeJson(io, {
    ok: valid,
    command: "verify-measurement",
    ...sourceIntegrityFields(source),
    measurementId: parsed.value.measurementId,
    measurementContractVersion: parsed.value.measurementContractVersion,
    ...(valid ? {} : { error: "measurement content digest does not match measurementId" }),
  });
  return valid ? SUCCESS_EXIT : FAILURE_EXIT;
}

export async function verifyDerivationCommand(path: string, io: Io): Promise<number> {
  const source = await readSourceFile(path);
  const parsed = parseSourceJson(source.bytes);
  if (!parsed.ok) {
    writeJson(io, {
      ok: false,
      command: "verify-derivation",
      ...sourceIntegrityFields(source),
      error: parsed.error,
    });
    return FAILURE_EXIT;
  }
  if (isDerivationRecordV1(parsed.value)) {
    const valid = await verifyDerivationRecord(parsed.value);
    writeJson(io, {
      ok: valid,
      command: "verify-derivation",
      ...sourceIntegrityFields(source),
      derivationId: parsed.value.derivationId,
      derivationContractVersion: parsed.value.derivationContractVersion,
      schemaVersion: parsed.value.schemaVersion,
      ...(valid ? {} : { error: "derivation content digest does not match derivationId" }),
    });
    return valid ? SUCCESS_EXIT : FAILURE_EXIT;
  }
  if (isDerivationRecordV2(parsed.value)) {
    const valid = await verifyDerivationRecordV2(parsed.value);
    writeJson(io, {
      ok: valid,
      command: "verify-derivation",
      ...sourceIntegrityFields(source),
      derivationId: parsed.value.derivationId,
      derivationContractVersion: parsed.value.derivationContractVersion,
      schemaVersion: parsed.value.schemaVersion,
      kind: parsed.value.kind,
      ...(valid ? {} : { error: "derivation content digest does not match derivationId" }),
    });
    return valid ? SUCCESS_EXIT : FAILURE_EXIT;
  }
  writeJson(io, {
    ok: false,
    command: "verify-derivation",
    ...sourceIntegrityFields(source),
    error: "not a derivation-record-1 or derivation-record-2 object",
  });
  return FAILURE_EXIT;
}

export async function verifyRepositoryCommand(path: string, io: Io): Promise<number> {
  const source = await readSourceFile(path);
  const parsed = parseSourceJson(source.bytes);
  if (!parsed.ok) {
    writeJson(io, {
      ok: false,
      command: "verify-repository",
      ...sourceIntegrityFields(source),
      error: parsed.error,
    });
    return FAILURE_EXIT;
  }
  if (!isResearchRepository(parsed.value)) {
    writeJson(io, {
      ok: false,
      command: "verify-repository",
      ...sourceIntegrityFields(source),
      error: "not an everything-rings-research-repository-1 object",
    });
    return FAILURE_EXIT;
  }
  try {
    const integrity = await verifyResearchRepositoryIntegrity(parsed.value);
    writeJson(io, {
      ok: integrity.valid,
      command: "verify-repository",
      ...sourceIntegrityFields(source),
      integrity,
    });
    return integrity.valid ? SUCCESS_EXIT : FAILURE_EXIT;
  } catch (error) {
    writeJson(io, {
      ok: false,
      command: "verify-repository",
      ...sourceIntegrityFields(source),
      error: error instanceof Error ? error.message : String(error),
    });
    return FAILURE_EXIT;
  }
}

/**
 * Freeze a research benchmark snapshot from a manifest.
 * Manifest bytes are hashed as-on-disk; the snapshot is created via
 * `createResearchBenchmarkSnapshot` and never mutates the source file.
 *
 * Usage: `er freeze dataset <manifest> [--out <snapshot.json>]`
 */
export async function freezeDatasetCommand(
  path: string | undefined,
  flags: ReadonlyMap<string, string | true>,
  io: Io,
): Promise<number> {
  if (path === undefined || path.length === 0) {
    io.stderr.write("error: expected `er freeze dataset <manifest> [--out <snapshot.json>]`\n");
    return FAILURE_EXIT;
  }
  const source = await readSourceFile(path);
  const parsed = parseSourceJson(source.bytes);
  if (!parsed.ok) {
    writeJson(io, {
      ok: false,
      command: "freeze-dataset",
      ...sourceIntegrityFields(source),
      error: parsed.error,
    });
    return FAILURE_EXIT;
  }

  // Verify-only path: already a content-addressed snapshot.
  if (isResearchBenchmarkSnapshot(parsed.value)) {
    const valid = await verifyResearchBenchmarkSnapshot(parsed.value);
    writeJson(io, {
      ok: valid,
      command: "freeze-dataset",
      mode: "verify-existing-snapshot",
      ...sourceIntegrityFields(source),
      snapshotId: parsed.value.snapshotId,
      membershipDigest: parsed.value.membershipDigest,
      ...(valid ? {} : { error: "research benchmark snapshot failed content verification" }),
    });
    return valid ? SUCCESS_EXIT : FAILURE_EXIT;
  }

  const manifest = parsed.value as Record<string, unknown>;
  if (!isFreezeManifest(manifest)) {
    writeJson(io, {
      ok: false,
      command: "freeze-dataset",
      ...sourceIntegrityFields(source),
      error: "manifest must supply createdAt, membershipObservationIds, exclusions, frozenLabels, frozenSplits, and frozenMetrics",
    });
    return FAILURE_EXIT;
  }

  let snapshot: ResearchBenchmarkSnapshotV1;
  try {
    snapshot = await createResearchBenchmarkSnapshot({
      createdAt: manifest.createdAt,
      membershipObservationIds: manifest.membershipObservationIds,
      exclusions: manifest.exclusions,
      frozenLabels: manifest.frozenLabels,
      frozenSplits: manifest.frozenSplits,
      frozenMetrics: manifest.frozenMetrics,
    });
  } catch (error) {
    writeJson(io, {
      ok: false,
      command: "freeze-dataset",
      ...sourceIntegrityFields(source),
      error: error instanceof Error ? error.message : String(error),
    });
    return FAILURE_EXIT;
  }

  const valid = await verifyResearchBenchmarkSnapshot(snapshot);
  if (!valid) {
    writeJson(io, {
      ok: false,
      command: "freeze-dataset",
      ...sourceIntegrityFields(source),
      error: "created snapshot failed self-verification",
    });
    return FAILURE_EXIT;
  }

  const outPath = flagString(flags, "out");
  if (outPath !== undefined) {
    await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  writeJson(io, {
    ok: true,
    command: "freeze-dataset",
    mode: "create-from-manifest",
    ...sourceIntegrityFields(source),
    snapshotId: snapshot.snapshotId,
    membershipDigest: snapshot.membershipDigest,
    membershipCount: snapshot.membershipObservationIds.length,
    exclusionCount: snapshot.exclusions.length,
    frozenMetricCount: snapshot.frozenMetrics.length,
    out: outPath ?? null,
    sourceMutated: false,
    snapshot,
  });
  return SUCCESS_EXIT;
}

/**
 * Inspect a derivation/measurement lineage graph.
 *
 * Usage:
 *   er inspect lineage <derivation-or-measurement-file>
 *   er inspect lineage <artifact-id> --from <graph-or-repository.json>
 */
export async function inspectLineageCommand(
  target: string | undefined,
  flags: ReadonlyMap<string, string | true>,
  io: Io,
): Promise<number> {
  if (target === undefined || target.length === 0) {
    io.stderr.write("error: expected `er inspect lineage <id-or-path> [--from <graph>]`\n");
    return FAILURE_EXIT;
  }

  const fromPath = flagString(flags, "from");
  let index: LineageGraphIndex;
  let rootId: string;
  let sourceIntegrity: Record<string, unknown> | null = null;

  if (fromPath !== undefined) {
    const graphSource = await readSourceFile(fromPath);
    const parsed = parseSourceJson(graphSource.bytes);
    if (!parsed.ok) {
      writeJson(io, {
        ok: false,
        command: "inspect-lineage",
        ...sourceIntegrityFields(graphSource),
        error: parsed.error,
      });
      return FAILURE_EXIT;
    }
    const graphIndex = indexFromUnknownGraph(parsed.value);
    if (graphIndex === null) {
      writeJson(io, {
        ok: false,
        command: "inspect-lineage",
        ...sourceIntegrityFields(graphSource),
        error: "not a research repository or lineage graph ({ measurements?, derivations?, snapshots? })",
      });
      return FAILURE_EXIT;
    }
    index = graphIndex;
    rootId = target;
    sourceIntegrity = sourceIntegrityFields(graphSource);
  } else {
    const exists = await pathExists(target);
    if (!exists) {
      writeJson(io, {
        ok: false,
        command: "inspect-lineage",
        id: target,
        error: "path not found; pass --from <graph-or-repository.json> when inspecting by artifact id",
      });
      return FAILURE_EXIT;
    }
    const source = await readSourceFile(target);
    const parsed = parseSourceJson(source.bytes);
    if (!parsed.ok) {
      writeJson(io, {
        ok: false,
        command: "inspect-lineage",
        ...sourceIntegrityFields(source),
        error: parsed.error,
      });
      return FAILURE_EXIT;
    }
    sourceIntegrity = sourceIntegrityFields(source);

    if (isDerivationRecordV1(parsed.value) || isDerivationRecordV2(parsed.value)) {
      index = indexDerivation(parsed.value);
      rootId = parsed.value.derivationId;
    } else if (isMeasurementRecord(parsed.value)) {
      index = indexMeasurement(parsed.value);
      rootId = parsed.value.measurementId;
    } else if (isResearchBenchmarkSnapshot(parsed.value)) {
      index = indexSnapshot(parsed.value);
      rootId = parsed.value.snapshotId;
    } else {
      const graphIndex = indexFromUnknownGraph(parsed.value);
      if (graphIndex === null) {
        writeJson(io, {
          ok: false,
          command: "inspect-lineage",
          ...sourceIntegrityFields(source),
          error: "file is not a derivation, measurement, snapshot, repository, or lineage graph",
        });
        return FAILURE_EXIT;
      }
      index = graphIndex;
      const preferred = firstGraphRoot(index);
      if (preferred === undefined) {
        writeJson(io, {
          ok: false,
          command: "inspect-lineage",
          ...sourceIntegrityFields(source),
          error: "lineage graph has no artifacts",
        });
        return FAILURE_EXIT;
      }
      rootId = preferred;
    }
  }

  const tree = walkLineage(rootId, index);
  writeJson(io, {
    ok: tree.present,
    command: "inspect-lineage",
    ...(sourceIntegrity ?? {}),
    rootId,
    lineage: tree,
    ...(tree.present ? {} : { error: `artifact ${rootId} is absent from the inspected graph` }),
  });
  return tree.present ? SUCCESS_EXIT : FAILURE_EXIT;
}

/**
 * Create MeasurementRecordV1 + MeasurementSourceLinkV1 from schema-v5 evidence.
 *
 * Safety: requires `--out <dir>` and never mutates the evidence file. Digests of
 * the evidence are SHA-256 of exact on-disk bytes. Intended for synthetic
 * fixtures and post-Gate-A2 conversion; does not migrate campaign evidence
 * in place. Pass `--allow-synthetic-ingest` to acknowledge this contract.
 *
 * Usage:
 *   er ingest measurement <evidence.json> --out <dir> --conversion-tool-revision <40hex>
 *     [--allow-synthetic-ingest] [--attempt <id>] [--station-id <id>]
 */
export async function ingestMeasurementCommand(
  path: string | undefined,
  flags: ReadonlyMap<string, string | true>,
  io: Io,
): Promise<number> {
  if (path === undefined || path.length === 0) {
    io.stderr.write("error: expected `er ingest measurement <evidence> --out <dir> --conversion-tool-revision <40hex> --allow-synthetic-ingest`\n");
    return FAILURE_EXIT;
  }
  const outDir = flagString(flags, "out");
  if (outDir === undefined) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      error: "refusing to ingest without --out <dir>; CLI never mutates source evidence and only writes to a caller-provided path",
    });
    return FAILURE_EXIT;
  }
  if (!flagPresent(flags, "allow-synthetic-ingest")) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      error: "refusing ingest without --allow-synthetic-ingest (writes MeasurementRecordV1 + MeasurementSourceLink to --out only; never migrates campaign evidence in place; Gate A2 lock required before production physical migration)",
    });
    return FAILURE_EXIT;
  }
  const conversionToolRevision = flagString(flags, "conversion-tool-revision");
  if (conversionToolRevision === undefined || !/^[0-9a-f]{40}$/.test(conversionToolRevision)) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      error: "--conversion-tool-revision must be an exact 40-hex Git revision",
    });
    return FAILURE_EXIT;
  }

  const source = await readSourceFile(path);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
  } catch {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: "file is not valid UTF-8",
    });
    return FAILURE_EXIT;
  }
  const evidenceParsed = parseValidationEvidenceJson(text);
  if (!evidenceParsed.ok) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: evidenceParsed.error,
    });
    return FAILURE_EXIT;
  }
  const evidence = evidenceParsed.evidence;
  const attemptIdRaw = flagString(flags, "attempt");
  const attemptId = attemptIdRaw === undefined ? undefined : Number(attemptIdRaw);
  if (attemptIdRaw !== undefined && (!Number.isInteger(attemptId) || (attemptId as number) <= 0)) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: "--attempt must be a positive integer",
    });
    return FAILURE_EXIT;
  }

  const selected = selectSuccessfulAttempt(evidence, attemptId);
  if (selected === undefined) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: attemptId === undefined
        ? "no successful analysis attempt in evidence"
        : `attempt ${attemptId} is missing or not a successful analysis`,
    });
    return FAILURE_EXIT;
  }

  const stationId = flagString(flags, "station-id") ?? "er-cli-synthetic-station";
  const deviceDescription = flagString(flags, "device-description") ?? "er-cli-ingest";
  const operatingSystem = flagString(flags, "operating-system") ?? "unspecified";
  const runtime = flagString(flags, "runtime") ?? "er-cli";
  const acquisitionContractVersion = flagString(flags, "acquisition-contract") ?? evidence.evidenceContractVersion;

  let measurement: MeasurementRecordV1;
  try {
    measurement = await createMeasurementRecord({
      createdAt: evidence.createdAt,
      specimenId: evidence.object.specimenId,
      sessionId: evidence.sessionId,
      attemptId: selected.id,
      material: evidence.object.material,
      acquisitionContractVersion,
      softwareRevision: evidence.softwareRevision,
      fingerprintAlgorithmVersion: selected.analysis.fingerprint.algorithmVersion,
      setup: evidence.protocol,
      station: {
        stationId,
        deviceDescription,
        operatingSystem,
        runtime,
        microphoneDescription: null,
        captureSettings: evidence.captureSettings,
      },
      fingerprint: selected.analysis.fingerprint,
    });
  } catch (error) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: error instanceof Error ? error.message : String(error),
    });
    return FAILURE_EXIT;
  }

  const measurementValid = await verifyMeasurementRecord(measurement);
  if (!measurementValid) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: "created measurement failed content verification",
    });
    return FAILURE_EXIT;
  }

  const originalFilename = basename(path);
  let sourceLink;
  try {
    sourceLink = await createMeasurementSourceLink({
      measurementId: measurement.measurementId,
      originalFilename,
      sourceByteDigest: source.digest,
      sourceContractVersion: evidence.evidenceContractVersion,
      sourceRevision: evidence.softwareRevision,
      conversionToolRevision,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: error instanceof Error ? error.message : String(error),
    });
    return FAILURE_EXIT;
  }
  const linkValid = await verifyMeasurementSourceLink(sourceLink);
  if (!linkValid) {
    writeJson(io, {
      ok: false,
      command: "ingest-measurement",
      ...sourceIntegrityFields(source),
      error: "created source-link failed content verification",
    });
    return FAILURE_EXIT;
  }

  await mkdir(outDir, { recursive: true });
  const measurementPath = join(outDir, "measurement.json");
  const sourceLinkPath = join(outDir, "source-link.json");
  await writeFile(measurementPath, `${JSON.stringify(measurement, null, 2)}\n`);
  await writeFile(sourceLinkPath, `${JSON.stringify(sourceLink, null, 2)}\n`);

  writeJson(io, {
    ok: true,
    command: "ingest-measurement",
    ...sourceIntegrityFields(source),
    measurementId: measurement.measurementId,
    sourceLinkId: sourceLink.sourceLinkId,
    attemptId: selected.id,
    outDir,
    measurementPath,
    sourceLinkPath,
    sourceMutated: false,
    writesOnlyToCallerOutput: true,
    allowSyntheticIngest: true,
  });
  return SUCCESS_EXIT;
}

function isFreezeManifest(value: Record<string, unknown>): value is {
  createdAt: string;
  membershipObservationIds: readonly string[];
  exclusions: ResearchBenchmarkSnapshotV1["exclusions"];
  frozenLabels: ResearchBenchmarkSnapshotV1["frozenLabels"];
  frozenSplits: ResearchBenchmarkSnapshotV1["frozenSplits"];
  frozenMetrics: readonly string[];
} {
  return typeof value.createdAt === "string"
    && Array.isArray(value.membershipObservationIds)
    && Array.isArray(value.exclusions)
    && Array.isArray(value.frozenLabels)
    && Array.isArray(value.frozenSplits)
    && Array.isArray(value.frozenMetrics);
}

function firstGraphRoot(index: LineageGraphIndex): string | undefined {
  for (const id of index.derivationsV2.keys()) return id;
  for (const id of index.derivationsV1.keys()) return id;
  for (const id of index.snapshots.keys()) return id;
  for (const id of index.measurements.keys()) return id;
  return undefined;
}

function selectSuccessfulAttempt(
  evidence: ValidationEvidenceV5,
  attemptId: number | undefined,
): { id: number; analysis: Extract<ValidationEvidenceV5["attempts"][number]["analysis"], { status: "success" }> } | undefined {
  const candidates = evidence.attempts.filter((attempt) => attempt.analysis.status === "success");
  if (attemptId !== undefined) {
    const match = candidates.find((attempt) => attempt.id === attemptId);
    if (match === undefined || match.analysis.status !== "success") return undefined;
    return { id: match.id, analysis: match.analysis };
  }
  const first = candidates[0];
  if (first === undefined || first.analysis.status !== "success") return undefined;
  return { id: first.id, analysis: first.analysis };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function readNumericField(text: string, key: string): number | undefined {
  const match = new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(text);
  if (match === null || match[1] === undefined) return undefined;
  return Number(match[1]);
}
