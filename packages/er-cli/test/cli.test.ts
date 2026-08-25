import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDerivationRecord,
  createDerivationRecordV2,
  createMeasurementRecord,
  createResearchBenchmarkSnapshot,
  DERIVATION_RECORD_V2_TEST_VECTOR,
  emptyResearchRepository,
  ingestDerivation,
  ingestMeasurement,
  parseValidationEvidenceJson,
  verifyMeasurementRecord,
  verifyMeasurementSourceLink,
  verifyResearchBenchmarkSnapshot,
} from "@everything-rings/validation";
import { runCli } from "../src/cli.ts";
import { sha256Digest } from "../src/sha256.ts";
import { captureIo, fingerprint, SOFTWARE_REVISION, validEvidence } from "./helpers.ts";

const dirs: string[] = [];

async function tempFile(name: string, contents: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "er-cli-"));
  dirs.push(dir);
  const path = join(dir, name);
  await writeFile(path, contents);
  return path;
}

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "er-cli-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("er hash", () => {
  it("reports SHA-256 of the original bytes and never a JSON reserialization", async () => {
    const pretty = `${JSON.stringify({ keep: "whitespace", order: [1, 2] }, null, 4)}\n`;
    const path = await tempFile("payload.json", pretty);
    const captured = captureIo();
    const code = await runCli(["hash", path], captured.io);
    const report = captured.json();
    expect(code).toBe(0);
    expect(report.ok).toBe(true);
    expect(report.reserialized).toBe(false);
    expect(report.sourceBytesHashed).toBe(true);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));
    expect(report.digest).not.toBe(await sha256Digest(new TextEncoder().encode(JSON.stringify(JSON.parse(pretty)))));
  });
});

describe("er verify evidence", () => {
  it("accepts schemaVersion 5 against the frozen parser without rewriting source bytes", async () => {
    const evidence = validEvidence();
    const pretty = `${JSON.stringify(evidence, null, 2)}\n`;
    const compact = JSON.stringify(JSON.parse(pretty));
    expect(pretty).not.toBe(compact);
    expect(parseValidationEvidenceJson(pretty).ok).toBe(true);
    expect(parseValidationEvidenceJson(compact).ok).toBe(true);

    const prettyPath = await tempFile("evidence-pretty.json", pretty);
    const compactPath = await tempFile("evidence-compact.json", compact);
    const prettyCapture = captureIo();
    const compactCapture = captureIo();
    expect(await runCli(["verify", "evidence", prettyPath], prettyCapture.io)).toBe(0);
    expect(await runCli(["verify", "evidence", compactPath], compactCapture.io)).toBe(0);

    const prettyReport = prettyCapture.json();
    const compactReport = compactCapture.json();
    expect(prettyReport.ok).toBe(true);
    expect(compactReport.ok).toBe(true);
    expect(prettyReport.schemaVersion).toBe(5);
    expect(prettyReport.evidenceContractVersion).toBe("validation-evidence-5");
    expect(prettyReport.reserialized).toBe(false);
    expect(prettyReport.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));
    expect(compactReport.digest).toBe(await sha256Digest(new TextEncoder().encode(compact)));
    expect(prettyReport.digest).not.toBe(compactReport.digest);
  });

  it("still reports the original digest when schema verification fails", async () => {
    const invalid = '{"schemaVersion":4,"evidenceContractVersion":"validation-evidence-4"}\n';
    const path = await tempFile("evidence-v4.json", invalid);
    const captured = captureIo();
    const code = await runCli(["verify", "evidence", path], captured.io);
    const report = captured.json();
    expect(code).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.schemaVersion).toBe(4);
    expect(report.reserialized).toBe(false);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(invalid)));
    expect(String(report.error)).toMatch(/schema version 5/);
  });
});

describe("er verify measurement and derivation", () => {
  it("verifies content-addressed V1 records from source bytes", async () => {
    const fp = fingerprint();
    const measurement = await createMeasurementRecord({
      createdAt: "2026-08-24T12:00:00.000Z",
      specimenId: "specimen-cli",
      sessionId: "session-cli",
      attemptId: 1,
      material: "metal",
      acquisitionContractVersion: "acquisition-browser-1",
      softwareRevision: SOFTWARE_REVISION,
      fingerprintAlgorithmVersion: fp.algorithmVersion,
      setup: {
        fixedSetup: true,
        microphoneDistanceCm: 20,
        striker: "wooden dowel",
        strikeLocation: "marked rim",
        supportCondition: "fixed support",
      },
      station: {
        stationId: "station-cli",
        deviceDescription: "digital station",
        operatingSystem: "test-os",
        runtime: "test",
        microphoneDescription: null,
        captureSettings: null,
      },
      fingerprint: fp,
    });
    const derivation = await createDerivationRecord({
      measurementId: measurement.measurementId,
      kind: "renderer",
      algorithmVersion: "modal-renderer-2",
      configDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      artifactDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      createdAt: "2026-08-24T13:00:00.000Z",
    });

    const measurementPath = await tempFile("measurement.json", JSON.stringify(measurement, null, 2));
    const derivationPath = await tempFile("derivation.json", JSON.stringify(derivation));
    const measurementCapture = captureIo();
    const derivationCapture = captureIo();
    expect(await runCli(["verify", "measurement", measurementPath], measurementCapture.io)).toBe(0);
    expect(await runCli(["verify", "derivation", derivationPath], derivationCapture.io)).toBe(0);
    expect(measurementCapture.json().measurementId).toBe(measurement.measurementId);
    expect(derivationCapture.json().derivationId).toBe(derivation.derivationId);

    const tampered = { ...measurement, specimenId: "mutated" };
    const tamperedPath = await tempFile("measurement-tampered.json", JSON.stringify(tampered));
    const tamperedCapture = captureIo();
    expect(await runCli(["verify", "measurement", tamperedPath], tamperedCapture.io)).toBe(1);
    expect(tamperedCapture.json().ok).toBe(false);
    expect(tamperedCapture.json().reserialized).toBe(false);
  });

  it("verifies derivation-record-2 with the official V2 test vector", async () => {
    const derivation = await createDerivationRecordV2({ ...DERIVATION_RECORD_V2_TEST_VECTOR.input });
    expect(derivation.derivationId).toBe(DERIVATION_RECORD_V2_TEST_VECTOR.expectedDerivationId);
    const pretty = `${JSON.stringify(derivation, null, 2)}\n`;
    const path = await tempFile("derivation-v2.json", pretty);
    const captured = captureIo();
    expect(await runCli(["verify", "derivation", path], captured.io)).toBe(0);
    const report = captured.json();
    expect(report.ok).toBe(true);
    expect(report.derivationContractVersion).toBe("derivation-record-2");
    expect(report.schemaVersion).toBe(2);
    expect(report.derivationId).toBe(derivation.derivationId);
    expect(report.reserialized).toBe(false);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));

    const tampered = { ...derivation, algorithmVersion: "mutated" };
    const tamperedPath = await tempFile("derivation-v2-tampered.json", JSON.stringify(tampered));
    const tamperedCapture = captureIo();
    expect(await runCli(["verify", "derivation", tamperedPath], tamperedCapture.io)).toBe(1);
    expect(tamperedCapture.json().ok).toBe(false);
  });
});

describe("er verify repository", () => {
  it("uses the validation integrity API without rewriting source bytes", async () => {
    const fp = fingerprint();
    const measurement = await createMeasurementRecord({
      createdAt: "2026-08-24T15:30:00.000Z",
      specimenId: "specimen-repo",
      sessionId: "session-repo",
      attemptId: 1,
      material: "other",
      acquisitionContractVersion: "digital-acquisition-1",
      softwareRevision: SOFTWARE_REVISION,
      fingerprintAlgorithmVersion: fp.algorithmVersion,
      setup: { fixedSetup: true, microphoneDistanceCm: 20, striker: "digital", strikeLocation: "A", supportCondition: "fixed" },
      station: {
        stationId: "digital-station",
        deviceDescription: "software",
        operatingSystem: "ci",
        runtime: "vitest",
        microphoneDescription: null,
        captureSettings: { sampleRate: 48_000, channelCount: 1 },
      },
      fingerprint: fp,
    });
    let repository = await ingestMeasurement(emptyResearchRepository(), measurement);
    const derivation = await createDerivationRecord({
      measurementId: measurement.measurementId,
      kind: "similarity",
      algorithmVersion: "sonic-twin-baseline-1",
      configDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      artifactDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      createdAt: "2026-08-24T15:31:00.000Z",
    });
    repository = await ingestDerivation(repository, derivation);
    const pretty = `${JSON.stringify(repository, null, 2)}\n`;
    const path = await tempFile("repository.json", pretty);
    const captured = captureIo();
    expect(await runCli(["verify", "repository", path], captured.io)).toBe(0);
    const report = captured.json();
    expect(report.ok).toBe(true);
    expect(report.reserialized).toBe(false);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));
    const integrity = report.integrity as { valid: boolean; measurementCount: number };
    expect(integrity.valid).toBe(true);
    expect(integrity.measurementCount).toBe(1);
  });
});

describe("er freeze dataset", () => {
  it("freezes a research benchmark snapshot from a synthetic manifest without mutating the source", async () => {
    const manifest = {
      createdAt: "2026-08-25T02:00:00.000Z",
      membershipObservationIds: ["obs-b", "obs-a"],
      exclusions: [{ observationId: "obs-excluded", reason: "quality-failure" }],
      frozenLabels: [{
        specimenId: "synth-bowl-001",
        identity: "custody-tag-synth-bowl-001",
        objectFamily: "bowl",
        material: { classification: "single", labels: ["metal"], source: "manufacturer" },
        provenance: { ownership: "research-lab", collectionSite: null, custodyNotes: null },
        displayLabel: "Synthetic brass bowl",
      }],
      frozenSplits: [
        { specimenId: "synth-bowl-001", captureId: "obs-a", primarySplit: "train", challengeSplits: [] },
        { specimenId: "synth-cup-001", captureId: "obs-b", primarySplit: "held-out", challengeSplits: [] },
      ],
      frozenMetrics: ["recall-at-1", "brier"],
    };
    const pretty = `${JSON.stringify(manifest, null, 2)}\n`;
    const path = await tempFile("freeze-manifest.json", pretty);
    const outDir = await tempDir();
    const outPath = join(outDir, "snapshot.json");
    const beforeDigest = await sha256Digest(await readFile(path));
    const captured = captureIo();
    expect(await runCli(["freeze", "dataset", path, "--out", outPath], captured.io)).toBe(0);
    const afterDigest = await sha256Digest(await readFile(path));
    expect(afterDigest).toBe(beforeDigest);

    const report = captured.json();
    expect(report.ok).toBe(true);
    expect(report.mode).toBe("create-from-manifest");
    expect(report.reserialized).toBe(false);
    expect(report.sourceMutated).toBe(false);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));
    expect(typeof report.snapshotId).toBe("string");
    expect(await verifyResearchBenchmarkSnapshot(report.snapshot as never)).toBe(true);

    const expected = await createResearchBenchmarkSnapshot(manifest as never);
    expect(report.snapshotId).toBe(expected.snapshotId);
    const written = JSON.parse(new TextDecoder().decode(await readFile(outPath))) as { snapshotId: string };
    expect(written.snapshotId).toBe(expected.snapshotId);
  });

  it("verifies an already-frozen snapshot file", async () => {
    const snapshot = await createResearchBenchmarkSnapshot({
      createdAt: "2026-08-25T02:00:00.000Z",
      membershipObservationIds: ["obs-a"],
      exclusions: [],
      frozenLabels: [{
        specimenId: "synth-bowl-001",
        identity: "id",
        objectFamily: "bowl",
        material: { classification: "single", labels: ["metal"], source: "manufacturer" },
        provenance: { ownership: null, collectionSite: null, custodyNotes: null },
        displayLabel: "bowl",
      }],
      frozenSplits: [
        { specimenId: "synth-bowl-001", captureId: "obs-a", primarySplit: "train", challengeSplits: [] },
      ],
      frozenMetrics: ["recall-at-1"],
    });
    const path = await tempFile("snapshot.json", JSON.stringify(snapshot));
    const captured = captureIo();
    expect(await runCli(["freeze", "dataset", path], captured.io)).toBe(0);
    expect(captured.json().mode).toBe("verify-existing-snapshot");
    expect(captured.json().snapshotId).toBe(snapshot.snapshotId);
  });
});

describe("er inspect lineage", () => {
  it("walks derivation-record-2 multi-source edges from a single file", async () => {
    const derivation = await createDerivationRecordV2({ ...DERIVATION_RECORD_V2_TEST_VECTOR.input });
    const path = await tempFile("lineage-v2.json", JSON.stringify(derivation));
    const captured = captureIo();
    expect(await runCli(["inspect", "lineage", path], captured.io)).toBe(0);
    const report = captured.json();
    expect(report.ok).toBe(true);
    expect(report.rootId).toBe(derivation.derivationId);
    const lineage = report.lineage as {
      kind: string;
      edges: readonly { relation: string; id: string }[];
      sources: readonly { id: string; kind: string }[];
    };
    expect(lineage.kind).toBe("derivation-record-2");
    expect(lineage.edges.map((edge) => edge.id).sort()).toEqual(
      [...DERIVATION_RECORD_V2_TEST_VECTOR.canonicalSourceMeasurementIds].sort(),
    );
    expect(lineage.sources.every((source) => source.kind === "missing")).toBe(true);
  });

  it("resolves nested V2/V1 lineage from a graph bundle by artifact id", async () => {
    const measurementId = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const child = await createDerivationRecord({
      measurementId,
      kind: "embedding",
      algorithmVersion: "embed-1",
      configDigest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      artifactDigest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      createdAt: "2026-08-25T00:00:00.000Z",
    });
    const parent = await createDerivationRecordV2({
      kind: "object-model",
      algorithmVersion: "acoustic-object-model-1",
      configDigest: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      sourceMeasurementIds: [measurementId],
      sourceDerivationIds: [child.derivationId],
      sourceDatasetSnapshotIds: [],
      artifactDigest: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      createdAt: "2026-08-25T01:00:00.000Z",
    });
    const graph = {
      measurements: [],
      derivations: [child, parent],
      snapshots: [],
    };
    const graphPath = await tempFile("lineage-graph.json", JSON.stringify(graph));
    const captured = captureIo();
    expect(await runCli(["inspect", "lineage", parent.derivationId, "--from", graphPath], captured.io)).toBe(0);
    const lineage = captured.json().lineage as {
      kind: string;
      sources: readonly {
        id: string;
        kind: string;
        sources: readonly { id: string; kind: string }[];
      }[];
    };
    expect(lineage.kind).toBe("derivation-record-2");
    const childNode = lineage.sources.find((source) => source.id === child.derivationId);
    expect(childNode?.kind).toBe("derivation-record-1");
    expect(childNode?.sources[0]?.id).toBe(measurementId);
    expect(childNode?.sources[0]?.kind).toBe("missing");
  });
});

describe("er ingest measurement", () => {
  it("creates MeasurementRecordV1 + MeasurementSourceLink only under --out and never mutates evidence", async () => {
    const evidence = validEvidence();
    const pretty = `${JSON.stringify(evidence, null, 2)}\n`;
    const path = await tempFile("synth-noncampaign-bowl.json", pretty);
    const outDir = await tempDir();
    const beforeDigest = await sha256Digest(await readFile(path));
    const conversionToolRevision = "89abcdef0123456789abcdef0123456789abcdef";
    const captured = captureIo();
    expect(await runCli([
      "ingest",
      "measurement",
      path,
      "--out",
      outDir,
      "--conversion-tool-revision",
      conversionToolRevision,
      "--allow-synthetic-ingest",
      "--attempt",
      "1",
      "--station-id",
      "synth-station",
    ], captured.io)).toBe(0);
    const afterDigest = await sha256Digest(await readFile(path));
    expect(afterDigest).toBe(beforeDigest);

    const report = captured.json();
    expect(report.ok).toBe(true);
    expect(report.sourceMutated).toBe(false);
    expect(report.writesOnlyToCallerOutput).toBe(true);
    expect(report.reserialized).toBe(false);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));

    const measurement = JSON.parse(new TextDecoder().decode(await readFile(join(outDir, "measurement.json"))));
    const sourceLink = JSON.parse(new TextDecoder().decode(await readFile(join(outDir, "source-link.json"))));
    expect(await verifyMeasurementRecord(measurement)).toBe(true);
    expect(await verifyMeasurementSourceLink(sourceLink)).toBe(true);
    expect(sourceLink.sourceByteDigest).toBe(report.digest);
    expect(sourceLink.originalFilename).toBe("synth-noncampaign-bowl.json");
    expect(sourceLink.conversionToolRevision).toBe(conversionToolRevision);
    expect(measurement.attemptId).toBe(1);
    expect(measurement.station.stationId).toBe("synth-station");
  });

  it("refuses ingest without --out or --allow-synthetic-ingest", async () => {
    const path = await tempFile("synth.json", JSON.stringify(validEvidence()));
    const noOut = captureIo();
    expect(await runCli([
      "ingest",
      "measurement",
      path,
      "--conversion-tool-revision",
      "89abcdef0123456789abcdef0123456789abcdef",
      "--allow-synthetic-ingest",
    ], noOut.io)).toBe(1);
    expect(String(noOut.json().error)).toMatch(/--out/);

    const noFlag = captureIo();
    const outDir = await tempDir();
    expect(await runCli([
      "ingest",
      "measurement",
      path,
      "--out",
      outDir,
      "--conversion-tool-revision",
      "89abcdef0123456789abcdef0123456789abcdef",
    ], noFlag.io)).toBe(1);
    expect(String(noFlag.json().error)).toMatch(/allow-synthetic-ingest/);
  });
});

describe("cli usage", () => {
  it("prints usage for help and rejects unknown commands", async () => {
    const help = captureIo();
    expect(await runCli(["--help"], help.io)).toBe(0);
    expect(help.stdout()).toMatch(/verify evidence/);
    expect(help.stdout()).toMatch(/freeze dataset/);
    expect(help.stdout()).toMatch(/ingest measurement/);
    const unknown = captureIo();
    expect(await runCli(["not-a-command"], unknown.io)).toBe(1);
    expect(unknown.stderr()).toMatch(/unknown command/);
  });

  it("runs the published bin wrapper against original file bytes", { timeout: 20_000 }, async () => {
    const { spawn } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const pretty = '{"ok":true}\n';
    const path = await tempFile("bin-hash.json", pretty);
    const bin = fileURLToPath(new URL("../bin/er.mjs", import.meta.url));
    const result = await new Promise<{ code: number | null; stdout: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [bin, "hash", path]);
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += new TextDecoder().decode(chunk); });
      child.stderr.on("data", (chunk) => { stderr += new TextDecoder().decode(chunk); });
      child.on("error", reject);
      child.on("close", (code) => {
        if (stderr.length > 0 && code !== 0) reject(new Error(stderr));
        else resolve({ code, stdout });
      });
    });
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout) as { digest: string; reserialized: boolean };
    expect(report.reserialized).toBe(false);
    expect(report.digest).toBe(await sha256Digest(new TextEncoder().encode(pretty)));
  });
});
