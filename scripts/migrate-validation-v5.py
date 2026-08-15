from pathlib import Path

ROOT = Path('.')
TEXT_SUFFIXES = {'.ts', '.tsx', '.md', '.sh'}


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    assert count == 1, f'{path}: expected 1 match, found {count}: {old[:100]!r}'
    write(path, text.replace(old, new))


def replace_all(path: str, old: str, new: str, expected: int | None = None) -> None:
    text = read(path)
    count = text.count(old)
    if expected is None:
        assert count > 0, f'{path}: expected at least 1 match: {old[:100]!r}'
    else:
        assert count == expected, f'{path}: expected {expected} matches, found {count}: {old[:100]!r}'
    write(path, text.replace(old, new))


def replace_repo(old: str, new: str) -> int:
    count = 0
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix not in TEXT_SUFFIXES:
            continue
        text = path.read_text()
        matches = text.count(old)
        if matches:
            path.write_text(text.replace(old, new))
            count += matches
    assert count > 0, f'expected repository matches for {old!r}'
    return count


# Evidence v5 is a breaking provenance contract; do not silently extend v4.
replace_repo('ValidationEvidenceV4', 'ValidationEvidenceV5')
replace_repo('validation-evidence-4', 'validation-evidence-5')
replace_once('packages/validation/src/types.ts', '  readonly schemaVersion: 4;\n', '  readonly schemaVersion: 5;\n')
replace_once('packages/validation/src/parse.ts', '  if (evidence.schemaVersion !== 4) return { ok: false, error: "requires validation evidence schema version 4" };', '  if (evidence.schemaVersion !== 5) return { ok: false, error: "requires validation evidence schema version 5" };')
replace_once('packages/validation/test/helpers.ts', '    schemaVersion: 4,\n', '    schemaVersion: 5,\n')
replace_all('apps/web/src/LabApp.tsx', '      schemaVersion: 4,\n', '      schemaVersion: 5,\n', expected=2)

# Mandatory software revision in the evidence contract and release verdict.
replace_once(
    'packages/validation/src/types.ts',
    '  readonly createdAt: string;\n  readonly object: ValidationObjectMetadata;',
    '  readonly createdAt: string;\n  readonly softwareRevision: string;\n  readonly object: ValidationObjectMetadata;',
)
replace_once(
    'packages/validation/src/types.ts',
    'export interface GateASessionVerdict {\n  readonly sessionId: string;\n  readonly specimenId: string;',
    'export interface GateASessionVerdict {\n  readonly sessionId: string;\n  readonly softwareRevision: string;\n  readonly specimenId: string;',
)
replace_once(
    'packages/validation/src/types.ts',
    'export interface GateAReleaseVerdict {\n  readonly contractVersion: "gate-a-2";\n  readonly passed: boolean;\n  readonly passingSessionCount: number;',
    'export interface GateAReleaseVerdict {\n  readonly contractVersion: "gate-a-2";\n  readonly passed: boolean;\n  readonly softwareRevision: string | null;\n  readonly passingSessionCount: number;',
)
replace_once(
    'packages/validation/src/types.ts',
    'export interface ReleaseVerdict {\n  readonly schemaVersion: 1;\n  readonly createdAt: string;\n  readonly gateA: GateAReleaseVerdict;',
    'export interface ReleaseVerdict {\n  readonly schemaVersion: 1;\n  readonly createdAt: string;\n  readonly softwareRevision: string | null;\n  readonly gateA: GateAReleaseVerdict;',
)

# Parser fails closed on a canonical full Git commit SHA.
replace_once(
    'packages/validation/src/parse.ts',
    'const NUMBER_TOLERANCE = 1e-9;\n',
    'const NUMBER_TOLERANCE = 1e-9;\nconst SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;\n',
)
replace_once(
    'packages/validation/src/parse.ts',
    '  if (!nonEmptyString(evidence.createdAt) || !Number.isFinite(Date.parse(evidence.createdAt))) {\n    return { ok: false, error: "createdAt is invalid" };\n  }\n  const sessionId = evidence.sessionId;',
    '  if (!nonEmptyString(evidence.createdAt) || !Number.isFinite(Date.parse(evidence.createdAt))) {\n    return { ok: false, error: "createdAt is invalid" };\n  }\n  if (typeof evidence.softwareRevision !== "string" || !SOFTWARE_REVISION_PATTERN.test(evidence.softwareRevision)) {\n    return { ok: false, error: "softwareRevision must be a lowercase 40-hex commit SHA" };\n  }\n  const sessionId = evidence.sessionId;',
)

# Same-session merges must preserve software provenance.
replace_once(
    'packages/validation/src/merge.ts',
    '    sessionId: evidence.sessionId,\n    object: evidence.object,',
    '    sessionId: evidence.sessionId,\n    softwareRevision: evidence.softwareRevision,\n    object: evidence.object,',
)

# Gate A release is homogeneous in software revision, including failed sessions.
replace_once(
    'packages/validation/src/evaluate.ts',
    'function normalizedLabel(label: string): string {',
    'const SOFTWARE_REVISION_PATTERN = /^[0-9a-f]{40}$/;\n\nfunction normalizedLabel(label: string): string {',
)
replace_once(
    'packages/validation/src/evaluate.ts',
    '  if (evidence.object.specimenId.trim().length === 0) reasons.push("specimen ID is missing");\n  if (evidence.object.label.trim().length === 0) reasons.push("object label is missing");',
    '  if (!SOFTWARE_REVISION_PATTERN.test(evidence.softwareRevision)) reasons.push("software revision is invalid");\n  if (evidence.object.specimenId.trim().length === 0) reasons.push("specimen ID is missing");\n  if (evidence.object.label.trim().length === 0) reasons.push("object label is missing");',
)
replace_once(
    'packages/validation/src/evaluate.ts',
    '  return {\n    sessionId: evidence.sessionId,\n    specimenId: evidence.object.specimenId,',
    '  return {\n    sessionId: evidence.sessionId,\n    softwareRevision: evidence.softwareRevision,\n    specimenId: evidence.object.specimenId,',
)
replace_once(
    'packages/validation/src/evaluate.ts',
    '  const distinctSpecimens = new Set(passing.map((session) => normalizedIdentifier(session.specimenId)));\n  const materialCoverage = [...new Set(passing.map((session) => session.material))];\n  const reasons: string[] = [];',
    '  const softwareRevisions = new Set(sessions.map((session) => session.softwareRevision));\n  const softwareRevision = softwareRevisions.size === 1 ? [...softwareRevisions][0] ?? null : null;\n  const distinctSpecimens = new Set(passing.map((session) => normalizedIdentifier(session.specimenId)));\n  const materialCoverage = [...new Set(passing.map((session) => session.material))];\n  const reasons: string[] = [];',
)
replace_once(
    'packages/validation/src/evaluate.ts',
    '  if (duplicateSessionIds.size > 0) {\n    reasons.push(`duplicate session IDs: ${[...duplicateSessionIds].join(", ")}`);\n  }\n  if (conflictingMaterialSpecimens.size > 0) {',
    '  if (duplicateSessionIds.size > 0) {\n    reasons.push(`duplicate session IDs: ${[...duplicateSessionIds].join(", ")}`);\n  }\n  if (softwareRevisions.size > 1) reasons.push("release evidence must use one software revision");\n  if (conflictingMaterialSpecimens.size > 0) {',
)
replace_once(
    'packages/validation/src/evaluate.ts',
    '    contractVersion: thresholds.contractVersion,\n    passed: reasons.length === 0,\n    passingSessionCount: passing.length,',
    '    contractVersion: thresholds.contractVersion,\n    passed: reasons.length === 0,\n    softwareRevision,\n    passingSessionCount: passing.length,',
)
replace_once(
    'packages/validation/src/evaluate.ts',
    '    schemaVersion: 1,\n    createdAt,\n    gateA,',
    '    schemaVersion: 1,\n    createdAt,\n    softwareRevision: gateA.softwareRevision,\n    gateA,',
)

# Deterministic fixture provenance.
replace_once(
    'packages/validation/test/helpers.ts',
    'import { deriveEvidenceRecurrence, deriveMedianModalDriftCents } from "../src";\n',
    'import { deriveEvidenceRecurrence, deriveMedianModalDriftCents } from "../src";\n\nexport const SOFTWARE_REVISION = "0123456789abcdef0123456789abcdef01234567";\n',
)
replace_once(
    'packages/validation/test/helpers.ts',
    '    readonly sessionId?: string;\n    readonly specimenId?: string;\n',
    '    readonly sessionId?: string;\n    readonly specimenId?: string;\n    readonly softwareRevision?: string;\n',
)
replace_once(
    'packages/validation/test/helpers.ts',
    '    createdAt: "2026-08-15T12:00:00.000Z",\n    object:',
    '    createdAt: "2026-08-15T12:00:00.000Z",\n    softwareRevision: options.softwareRevision ?? SOFTWARE_REVISION,\n    object:',
)

# Lab builds must be stamped; unstamped builds cannot arm release collection.
replace_once(
    'apps/web/src/LabApp.tsx',
    '];\n\nfunction createSessionId(): string {',
    '];\n\nconst SOFTWARE_REVISION = ((import.meta as ImportMeta & { readonly env?: { readonly VITE_SOFTWARE_REVISION?: string } }).env?.VITE_SOFTWARE_REVISION ?? "").trim();\nconst SOFTWARE_REVISION_VALID = /^[0-9a-f]{40}$/.test(SOFTWARE_REVISION);\n\nfunction createSessionId(): string {',
)
replace_once(
    'apps/web/src/LabApp.tsx',
    '  const protocolReady = specimenId.trim().length > 0\n',
    '  const protocolReady = SOFTWARE_REVISION_VALID\n    && specimenId.trim().length > 0\n',
)
replace_once(
    'apps/web/src/LabApp.tsx',
    '      sessionId,\n      createdAt,\n      object: activeObject,',
    '      sessionId,\n      createdAt,\n      softwareRevision: SOFTWARE_REVISION,\n      object: activeObject,',
)
replace_once(
    'apps/web/src/LabApp.tsx',
    '      sessionId,\n      createdAt: "preview",\n      object: activeObject,',
    '      sessionId,\n      createdAt: "preview",\n      softwareRevision: SOFTWARE_REVISION,\n      object: activeObject,',
)
replace_once(
    'apps/web/src/LabApp.tsx',
    '          <label><span>support condition</span><input disabled={protocolLocked} value={supportCondition} onChange={(event) => setSupportCondition(event.target.value)} /></label>\n        </div>\n      </section>',
    '          <label><span>support condition</span><input disabled={protocolLocked} value={supportCondition} onChange={(event) => setSupportCondition(event.target.value)} /></label>\n        </div>\n        <p className="validation-note">{SOFTWARE_REVISION_VALID ? `software revision ${SOFTWARE_REVISION}` : "UNSTAMPED BUILD — release evidence collection disabled."}</p>\n      </section>',
)

# Release console exposes and exports provenance.
replace_once(
    'apps/web/src/ReleaseApp.tsx',
    '        object: bundle.object,\n        createdAt: bundle.createdAt,',
    '        object: bundle.object,\n        createdAt: bundle.createdAt,\n        softwareRevision: bundle.softwareRevision,',
)
replace_once(
    'apps/web/src/ReleaseApp.tsx',
    '        <p className="small">Release becomes ready only when Gate A2, Gate B, and Gate C all pass their frozen contracts.</p>',
    '        <p className="small">Release becomes ready only when Gate A2, Gate B, and Gate C all pass their frozen contracts.</p>\n        <p className="small">Software revision: {verdict.softwareRevision ?? "mixed / no evidence"}</p>',
)
replace_once(
    'apps/web/src/ReleaseApp.tsx',
    '          <div><dt>specimen ID</dt><dd>{session.specimenId}</dd></div>\n          <div><dt>qualified attempts</dt>',
    '          <div><dt>specimen ID</dt><dd>{session.specimenId}</dd></div>\n          <div><dt>software revision</dt><dd>{session.softwareRevision}</dd></div>\n          <div><dt>qualified attempts</dt>',
)

# Build/deploy inject the exact revision. Browser smoke verifies that the stamp reached the DOM.
replace_once(
    '.github/workflows/ci.yml',
    '  validate:\n    runs-on: ubuntu-latest\n    steps:',
    '  validate:\n    runs-on: ubuntu-latest\n    env:\n      VITE_SOFTWARE_REVISION: ${{ github.sha }}\n    steps:',
)
replace_once(
    '.github/workflows/pages.yml',
    '  build:\n    runs-on: ubuntu-24.04\n    needs: pages-status',
    '  build:\n    runs-on: ubuntu-24.04\n    env:\n      VITE_SOFTWARE_REVISION: ${{ github.sha }}\n    needs: pages-status',
)
replace_once(
    'scripts/browser-smoke.sh',
    'check_route "/?lab=1" "Acoustic analysis lab" "lab"\ncheck_route "/?release=1"',
    'check_route "/?lab=1" "Acoustic analysis lab" "lab"\nif [[ -n "${VITE_SOFTWARE_REVISION:-}" ]] && ! grep -Fq "software revision ${VITE_SOFTWARE_REVISION}" /tmp/everything-rings-lab.html; then\n  echo "Browser smoke test failed: validation build revision is not visible in the lab" >&2\n  cat /tmp/everything-rings-lab.html >&2\n  exit 1\nfi\ncheck_route "/?release=1"',
)

# Regression tests for provenance and version rejection.
replace_once(
    'packages/validation/test/evaluate.test.ts',
    '  it("requires five distinct passing physical specimens with metal, glass, and ceramic coverage", () => {\n    expect(evaluateGateARelease(fiveObjects()).passed).toBe(true);\n    const alias = [...fiveObjects().slice(0, 4), evidence("desk bell", "metal", { specimenId: "specimen-bell", sessionId: "session-bell-2" })];\n    const verdict = evaluateGateARelease(alias);\n    expect(verdict.passed).toBe(false);\n    expect(verdict.distinctPassingSpecimenCount).toBe(4);\n  });',
    '  it("requires five distinct passing physical specimens with metal, glass, and ceramic coverage", () => {\n    expect(evaluateGateARelease(fiveObjects()).passed).toBe(true);\n    const alias = [...fiveObjects().slice(0, 4), evidence("desk bell", "metal", { specimenId: "specimen-bell", sessionId: "session-bell-2" })];\n    const verdict = evaluateGateARelease(alias);\n    expect(verdict.passed).toBe(false);\n    expect(verdict.distinctPassingSpecimenCount).toBe(4);\n  });\n\n  it("rejects release evidence mixed across software revisions", () => {\n    const mixed = fiveObjects().map((bundle, index) => index === 4\n      ? { ...bundle, softwareRevision: "fedcba9876543210fedcba9876543210fedcba98" }\n      : bundle);\n    const verdict = evaluateGateARelease(mixed);\n    expect(verdict.passed).toBe(false);\n    expect(verdict.softwareRevision).toBeNull();\n    expect(verdict.reasons.some((reason) => reason.includes("one software revision"))).toBe(true);\n  });',
)
replace_once(
    'packages/validation/test/evaluate.test.ts',
    '    expect(verdict.gateC.passed).toBe(true);\n    expect(verdict.releaseReady).toBe(true);',
    '    expect(verdict.gateC.passed).toBe(true);\n    expect(verdict.softwareRevision).toBe(bundles[0]?.softwareRevision);\n    expect(verdict.releaseReady).toBe(true);',
)
# This block has not been renamed in its human-readable title by the mechanical contract rename.
replace_once(
    'packages/validation/test/evaluate.test.ts',
    '  it("accepts schema v4, requires specimen identity, and rejects the superseded record-only schema", () => {\n    const bundle = evidence("bell", "metal");\n    expect(parseValidationEvidence(bundle).ok).toBe(true);\n    expect(parseValidationEvidence({ ...bundle, object: { label: bundle.object.label, material: bundle.object.material } }).ok).toBe(false);\n    expect(parseValidationEvidence({ schemaVersion: 3, evidenceContractVersion: "validation-evidence-3" }).ok).toBe(false);\n  });',
    '  it("accepts schema v5, requires specimen and software provenance, and rejects superseded schemas", () => {\n    const bundle = evidence("bell", "metal");\n    expect(parseValidationEvidence(bundle).ok).toBe(true);\n    expect(parseValidationEvidence({ ...bundle, object: { label: bundle.object.label, material: bundle.object.material } }).ok).toBe(false);\n    const { softwareRevision: _softwareRevision, ...withoutRevision } = bundle;\n    expect(parseValidationEvidence(withoutRevision).ok).toBe(false);\n    expect(parseValidationEvidence({ ...bundle, softwareRevision: "deadbeef" }).ok).toBe(false);\n    expect(parseValidationEvidence({ schemaVersion: 4, evidenceContractVersion: "validation-evidence-4" }).ok).toBe(false);\n    expect(parseValidationEvidence({ schemaVersion: 3, evidenceContractVersion: "validation-evidence-3" }).ok).toBe(false);\n  });',
)
replace_once(
    'packages/validation/test/contracts.test.ts',
    '  it("rejects reuse of a session ID with different qualified-attempt evidence", () => {',
    '  it("rejects reuse of a session ID under a different software revision", () => {\n    const first = evidence("bell", "metal");\n    const second = { ...first, softwareRevision: "fedcba9876543210fedcba9876543210fedcba98" };\n    const merged = mergeValidationEvidence(first, second);\n    expect(merged.ok).toBe(false);\n    if (!merged.ok) expect(merged.error).toContain("different measurement evidence");\n  });\n\n  it("rejects reuse of a session ID with different qualified-attempt evidence", () => {',
)

# Documentation: v5 supersedes v4 before physical release data collection.
replace_repo('schemaVersion: 4', 'schemaVersion: 5')
replace_repo('Schema version 4', 'Schema version 5')
replace_repo('schema v4', 'schema v5')
replace_repo('Schema v4', 'Schema v5')
replace_once(
    'docs/VALIDATION_EVIDENCE.md',
    '- a stable session ID and creation time;\n- a required stable physical `specimenId`, plus human-readable object label and material class;',
    '- a stable session ID and creation time;\n- the exact 40-hex software commit revision that produced the evidence;\n- a required stable physical `specimenId`, plus human-readable object label and material class;',
)
replace_once(
    'docs/VALIDATION_EVIDENCE.md',
    'Raw microphone PCM is intentionally excluded. Every bundle contains `rawMicrophoneSamplesIncluded: false`, and the parser rejects a bundle that violates that invariant.\n\n## Physical specimen identity',
    'Raw microphone PCM is intentionally excluded. Every bundle contains `rawMicrophoneSamplesIncluded: false`, and the parser rejects a bundle that violates that invariant.\n\n## Software provenance\n\nEvery schema-v5 bundle must contain `softwareRevision`, a lowercase 40-hex Git commit SHA. The validation lab disables release evidence collection when its build is unstamped. CI and the Pages deployment inject the exact build SHA through `VITE_SOFTWARE_REVISION`.\n\nGate A release evaluation requires one software revision across all imported sessions, including sessions that fail physically. Mixing evidence produced by different implementations is an evidence-integrity failure. Re-exporting one session under a different revision is also rejected by the immutable measurement-core merge.\n\nThe SHA, not a branch name, is the authoritative provenance identifier.\n\n## Physical specimen identity',
)
replace_once(
    'docs/VALIDATION_EVIDENCE.md',
    'This is the principal semantic difference from the superseded record-only schema v3. Schema v5 makes analytical failures visible so release evaluation cannot select only successful analyses.',
    'Schema v5 retains v4\'s qualified-attempt semantics and adds mandatory software provenance. The earlier record-only schema v3 remains superseded because it could not make analytical failures visible without a selection loophole. Schema v4 is rejected for release collection because it did not bind evidence to the implementation revision that produced it.',
)
replace_once(
    'docs/VALIDATION_EVIDENCE.md',
    'A session ID identifies one immutable physical measurement core: specimen identity, object label and material, fixed setup, capture settings, qualified attempts, analytical outcomes, fingerprints, and derived recurrence evidence.',
    'A session ID identifies one immutable physical measurement core: software revision, specimen identity, object label and material, fixed setup, capture settings, qualified attempts, analytical outcomes, fingerprints, and derived recurrence evidence.',
)
replace_once(
    'docs/VALIDATION_EVIDENCE.md',
    'The v4/A2 migration and specimen-identity migration occurred before the release physical dataset was accepted because the earlier forms could encode selection or identity ambiguity.',
    'The v5/A2 provenance migration occurred before the release physical dataset was accepted. It preserves the v4 no-selection and specimen-identity invariants and additionally binds every bundle to one implementation commit.',
)
replace_once(
    'docs/GATE_A.md',
    'Gate A2 uses `validation-evidence-5` with `schemaVersion: 5` and `gateAContractVersion: "gate-a-2"`. The previous record-only Gate A1 format is superseded for release evaluation because it could not represent qualified analytical failures without selection bias.',
    'Gate A2 uses `validation-evidence-5` with `schemaVersion: 5` and `gateAContractVersion: "gate-a-2"`. Schema v5 requires the exact software commit and release-level evidence must use one revision. Schema v4 is superseded before physical release collection because it lacked implementation provenance; the older record-only Gate A1 format is also superseded because it could not represent qualified analytical failures without selection bias.',
)
replace_once(
    'docs/GATE_A.md',
    'Gate A2 passes at release level when at least five distinct physical specimen IDs have passing sessions and the passing set contains metal, glass, and ceramic objects.',
    'Gate A2 passes at release level when all imported sessions come from one software revision, at least five distinct physical specimen IDs have passing sessions, and the passing set contains metal, glass, and ceramic objects.',
)
replace_once(
    'README.md',
    'Evidence schema v5 records those success/failure outcomes explicitly, and recurrence is recomputed from retained fingerprints with attempt 1 fixed as the reference.',
    'Evidence schema v5 records those success/failure outcomes explicitly, stamps the exact software commit that produced each bundle, and recomputes recurrence from retained fingerprints with attempt 1 fixed as the reference.',
)
replace_once(
    'README.md',
    'pnpm build\n```\n\nThe root web experience',
    'pnpm build\n```\n\nRelease-validation builds must set `VITE_SOFTWARE_REVISION` to the exact 40-hex Git commit. The GitHub Pages and CI workflows do this automatically; an unstamped local build can use the consumer surfaces but cannot arm release evidence collection.\n\nThe root web experience',
)

# No accidental v4 type/contract references remain outside the explicit rejection test and provenance history.
for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix not in TEXT_SUFFIXES:
        continue
    text = path.read_text()
    assert 'ValidationEvidenceV4' not in text, f'{path}: stale ValidationEvidenceV4'

print('validation evidence v5 provenance migration applied')
