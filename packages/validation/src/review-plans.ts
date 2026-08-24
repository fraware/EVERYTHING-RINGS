import type {
  GateAReleaseVerdict,
  GateBReleaseVerdict,
  GateBReview,
  GateCReleaseVerdict,
  GateCReview,
  ReviewTarget,
} from "./types";
import { evaluateGateBRelease, evaluateGateCRelease } from "./evaluate";

export interface PlannedReviewTarget extends ReviewTarget {
  readonly specimenId: string;
  readonly objectLabel: string;
}

export interface GateBPlanV1 {
  readonly schemaVersion: 1;
  readonly planContractVersion: "gate-b-plan-1";
  readonly gateARevision: string;
  readonly reviewerIds: readonly [string, string];
  readonly targets: readonly PlannedReviewTarget[];
}

export interface GateCDevicePlan {
  readonly deviceId: string;
  readonly deviceClass: "desktop" | "mobile" | "tablet" | "other";
}

export interface GateCPlanV1 {
  readonly schemaVersion: 1;
  readonly planContractVersion: "gate-c-plan-1";
  readonly reviewerIds: readonly [string, string];
  readonly devices: readonly [GateCDevicePlan, GateCDevicePlan];
  readonly targets: readonly PlannedReviewTarget[];
}

export interface CanonicalGateBResult {
  readonly passed: boolean;
  readonly expectedJudgmentCount: 10;
  readonly observedJudgmentCount: number;
  readonly reasons: readonly string[];
  readonly verdict: GateBReleaseVerdict;
}

export interface CanonicalGateCResult {
  readonly passed: boolean;
  readonly expectedJudgmentCount: 16;
  readonly observedJudgmentCount: number;
  readonly reasons: readonly string[];
  readonly verdict: GateCReleaseVerdict;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function targetKey(target: ReviewTarget): string {
  return `${target.sessionId}\u0000${target.attemptId}`;
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function rankTargets(
  domain: string,
  targets: readonly PlannedReviewTarget[],
): Promise<readonly PlannedReviewTarget[]> {
  const ranked = await Promise.all(targets.map(async (target) => ({
    target,
    digest: await sha256Text(`${domain}|${normalize(target.specimenId)}|${target.sessionId}|${target.attemptId}`),
  })));
  ranked.sort((left, right) => left.digest.localeCompare(right.digest));
  return ranked.map(({ target }) => target);
}

function gateATargets(gateA: GateAReleaseVerdict): PlannedReviewTarget[] {
  return gateA.sessions
    .filter((session) => session.passed && session.reviewAttemptId !== null)
    .map((session) => ({
      specimenId: session.specimenId,
      objectLabel: session.objectLabel,
      sessionId: session.sessionId,
      attemptId: session.reviewAttemptId as number,
    }));
}

function uniqueSpecimenTargets(targets: readonly PlannedReviewTarget[]): PlannedReviewTarget[] {
  const bySpecimen = new Map<string, PlannedReviewTarget>();
  for (const target of targets) {
    const key = normalize(target.specimenId);
    if (!bySpecimen.has(key)) bySpecimen.set(key, target);
  }
  return [...bySpecimen.values()];
}

function assertFixedPair(values: readonly string[], field: string): readonly [string, string] {
  if (values.length !== 2) throw new Error(`${field} must contain exactly two values`);
  const normalized = values.map(normalize);
  if (normalized.some((value) => value.length === 0)) throw new Error(`${field} values must be non-empty`);
  if (normalized[0] === normalized[1]) throw new Error(`${field} values must be distinct after normalization`);
  return [values[0]!.trim(), values[1]!.trim()];
}

export async function createGateBPlan(
  gateA: GateAReleaseVerdict,
  reviewerIds: readonly string[],
): Promise<GateBPlanV1> {
  if (!gateA.passed || gateA.softwareRevision === null) throw new Error("Gate A must pass before Gate B planning");
  const reviewers = assertFixedPair(reviewerIds, "reviewerIds");
  const all = uniqueSpecimenTargets(await rankTargets("gate-b-target-v1", gateATargets(gateA)));
  const byMaterial = new Map(gateA.sessions
    .filter((session) => session.passed)
    .map((session) => [normalize(session.specimenId), session.material] as const));

  const selected: PlannedReviewTarget[] = [];
  for (const material of ["metal", "glass", "ceramic"] as const) {
    const target = all.find((candidate) => byMaterial.get(normalize(candidate.specimenId)) === material);
    if (target === undefined) throw new Error(`Gate B planning requires a passing ${material} target`);
    selected.push(target);
  }
  const selectedKeys = new Set(selected.map((target) => normalize(target.specimenId)));
  selected.push(...all.filter((target) => !selectedKeys.has(normalize(target.specimenId))).slice(0, 2));
  if (selected.length !== 5) throw new Error("Gate B planning requires exactly five passing specimens");

  return {
    schemaVersion: 1,
    planContractVersion: "gate-b-plan-1",
    gateARevision: gateA.softwareRevision,
    reviewerIds: reviewers,
    targets: selected,
  };
}

export async function createGateCPlan(
  gateB: GateBReleaseVerdict,
  reviewerIds: readonly string[],
  devices: readonly GateCDevicePlan[],
): Promise<GateCPlanV1> {
  if (!gateB.passed) throw new Error("Gate B must pass before Gate C planning");
  const reviewers = assertFixedPair(reviewerIds, "reviewerIds");
  if (devices.length !== 2) throw new Error("Gate C planning requires exactly two devices");
  const deviceIds = devices.map((device) => normalize(device.deviceId));
  if (deviceIds.some((value) => value.length === 0) || deviceIds[0] === deviceIds[1]) {
    throw new Error("Gate C devices must have two distinct non-empty IDs");
  }
  if (!devices.some((device) => device.deviceClass === "mobile")) {
    throw new Error("Gate C device plan must include a mobile device");
  }
  const passingTargets = gateB.objects
    .filter((object) => object.passed && object.selectedTarget !== null)
    .map((object) => ({
      specimenId: object.specimenId,
      objectLabel: object.objectLabel,
      sessionId: object.selectedTarget!.sessionId,
      attemptId: object.selectedTarget!.attemptId,
    }));
  const ranked = await rankTargets("gate-c-target-v1", uniqueSpecimenTargets(passingTargets));
  const targets = ranked.slice(0, 4);
  if (targets.length !== 4) throw new Error("Gate C planning requires four passing Gate B specimens");
  return {
    schemaVersion: 1,
    planContractVersion: "gate-c-plan-1",
    reviewerIds: reviewers,
    devices: [devices[0]!, devices[1]!],
    targets,
  };
}

export function evaluateCanonicalGateB(
  plan: GateBPlanV1,
  gateA: GateAReleaseVerdict,
  reviews: readonly GateBReview[],
): CanonicalGateBResult {
  const reasons: string[] = [];
  if (!gateA.passed) reasons.push("Gate A has not passed");
  if (gateA.softwareRevision !== plan.gateARevision) reasons.push("Gate B plan revision does not match Gate A");
  if (plan.targets.length !== 5) reasons.push("Gate B plan must contain exactly five targets");
  const expectedReviewers = new Set(plan.reviewerIds.map(normalize));
  const expectedTargets = new Map(plan.targets.map((target) => [targetKey(target), target] as const));
  const canonical = reviews.filter((review) => expectedTargets.has(targetKey(review)));

  for (const review of canonical) {
    if (!expectedReviewers.has(normalize(review.reviewerId))) reasons.push(`unexpected Gate B reviewer ${review.reviewerId}`);
    if (!review.blinded) reasons.push(`Gate B review ${review.reviewId} is not blinded`);
  }
  for (const target of plan.targets) {
    const targetReviews = canonical.filter((review) => targetKey(review) === targetKey(target));
    const reviewerSet = new Set(targetReviews.map((review) => normalize(review.reviewerId)));
    if (targetReviews.length !== 2 || reviewerSet.size !== 2 || [...expectedReviewers].some((id) => !reviewerSet.has(id))) {
      reasons.push(`Gate B target ${target.specimenId} does not have the exact fixed two-reviewer panel`);
    }
  }
  if (canonical.length !== 10) reasons.push("Gate B requires exactly ten canonical judgments");

  const verdict = evaluateGateBRelease(gateA, canonical);
  if (!verdict.passed) reasons.push(...verdict.reasons);
  return {
    passed: reasons.length === 0,
    expectedJudgmentCount: 10,
    observedJudgmentCount: canonical.length,
    reasons: [...new Set(reasons)],
    verdict,
  };
}

export function evaluateCanonicalGateC(
  plan: GateCPlanV1,
  gateB: GateBReleaseVerdict,
  reviews: readonly GateCReview[],
): CanonicalGateCResult {
  const reasons: string[] = [];
  if (!gateB.passed) reasons.push("Gate B has not passed");
  if (plan.targets.length !== 4) reasons.push("Gate C plan must contain exactly four targets");
  const expectedReviewers = new Set(plan.reviewerIds.map(normalize));
  const expectedDevices = new Map(plan.devices.map((device) => [normalize(device.deviceId), device] as const));
  const expectedTargets = new Map(plan.targets.map((target) => [targetKey(target), target] as const));
  const canonical = reviews.filter((review) => expectedTargets.has(targetKey(review)));

  for (const review of canonical) {
    if (!expectedReviewers.has(normalize(review.reviewerId))) reasons.push(`unexpected Gate C reviewer ${review.reviewerId}`);
    const device = expectedDevices.get(normalize(review.deviceId));
    if (device === undefined) reasons.push(`unexpected Gate C device ${review.deviceId}`);
    else if (device.deviceClass !== review.deviceClass) reasons.push(`Gate C device class mismatch for ${review.deviceId}`);
  }

  for (const target of plan.targets) {
    const cells = new Set(canonical
      .filter((review) => targetKey(review) === targetKey(target))
      .map((review) => `${normalize(review.reviewerId)}\u0000${normalize(review.deviceId)}`));
    for (const reviewerId of expectedReviewers) {
      for (const deviceId of expectedDevices.keys()) {
        if (!cells.has(`${reviewerId}\u0000${deviceId}`)) {
          reasons.push(`Gate C target ${target.specimenId} is missing reviewer/device cell ${reviewerId}/${deviceId}`);
        }
      }
    }
    if (cells.size !== 4) reasons.push(`Gate C target ${target.specimenId} must contain exactly four canonical cells`);
  }
  if (canonical.length !== 16) reasons.push("Gate C requires exactly sixteen canonical judgments");

  const verdict = evaluateGateCRelease(gateB, canonical);
  if (!verdict.passed) reasons.push(...verdict.reasons);
  return {
    passed: reasons.length === 0,
    expectedJudgmentCount: 16,
    observedJudgmentCount: canonical.length,
    reasons: [...new Set(reasons)],
    verdict,
  };
}
