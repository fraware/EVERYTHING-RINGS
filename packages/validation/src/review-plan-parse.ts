import type { DeviceClass } from "./types";
import type { GateBPlanV1, GateCDevicePlan, GateCPlanV1, PlannedReviewTarget } from "./review-plans";

export type GateBPlanParseResult = { readonly ok: true; readonly plan: GateBPlanV1 } | { readonly ok: false; readonly error: string };
export type GateCPlanParseResult = { readonly ok: true; readonly plan: GateCPlanV1 } | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonempty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new TypeError(`${field} must be a positive integer`);
  return value;
}

function parseTarget(value: unknown, field: string): PlannedReviewTarget {
  if (!isRecord(value)) throw new TypeError(`${field} must be an object`);
  return {
    specimenId: nonempty(value.specimenId, `${field}.specimenId`),
    objectLabel: nonempty(value.objectLabel, `${field}.objectLabel`),
    sessionId: nonempty(value.sessionId, `${field}.sessionId`),
    attemptId: positiveInteger(value.attemptId, `${field}.attemptId`),
  };
}

function parseFixedReviewers(value: unknown, field: string): readonly [string, string] {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`${field} must contain exactly two reviewer IDs`);
  const reviewers: [string, string] = [nonempty(value[0], `${field}[0]`), nonempty(value[1], `${field}[1]`)];
  if (reviewers[0].toLocaleLowerCase("en-US") === reviewers[1].toLocaleLowerCase("en-US")) throw new TypeError(`${field} reviewer IDs must be distinct`);
  return reviewers;
}

function uniqueTargets(targets: readonly PlannedReviewTarget[], expected: number, field: string): void {
  if (targets.length !== expected) throw new TypeError(`${field} must contain exactly ${expected} targets`);
  const specimens = new Set(targets.map((target) => target.specimenId.trim().toLocaleLowerCase("en-US")));
  const targetKeys = new Set(targets.map((target) => `${target.sessionId}\u0000${target.attemptId}`));
  if (specimens.size !== expected) throw new TypeError(`${field} specimen IDs must be distinct`);
  if (targetKeys.size !== expected) throw new TypeError(`${field} session/attempt targets must be distinct`);
}

export function parseGateBPlan(value: unknown): GateBPlanParseResult {
  try {
    if (!isRecord(value)) throw new TypeError("Gate B plan must be an object");
    if (value.schemaVersion !== 1) throw new TypeError("Gate B plan schemaVersion must be 1");
    if (value.planContractVersion !== "gate-b-plan-1") throw new TypeError("Gate B plan contract must be gate-b-plan-1");
    const gateARevision = nonempty(value.gateARevision, "gateARevision");
    if (!/^[0-9a-f]{40}$/.test(gateARevision)) throw new TypeError("gateARevision must be an exact 40-hex Git revision");
    const reviewerIds = parseFixedReviewers(value.reviewerIds, "reviewerIds");
    if (!Array.isArray(value.targets)) throw new TypeError("targets must be an array");
    const targets = value.targets.map((target, index) => parseTarget(target, `targets[${index}]`));
    uniqueTargets(targets, 5, "targets");
    return { ok: true, plan: { schemaVersion: 1, planContractVersion: "gate-b-plan-1", gateARevision, reviewerIds, targets } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseGateBPlanJson(json: string): GateBPlanParseResult {
  try { return parseGateBPlan(JSON.parse(json) as unknown); }
  catch (error) { return { ok: false, error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` }; }
}

function parseDevice(value: unknown, field: string): GateCDevicePlan {
  if (!isRecord(value)) throw new TypeError(`${field} must be an object`);
  const deviceClass = nonempty(value.deviceClass, `${field}.deviceClass`) as DeviceClass;
  if (!["desktop", "mobile", "tablet", "other"].includes(deviceClass)) throw new TypeError(`${field}.deviceClass is invalid`);
  return { deviceId: nonempty(value.deviceId, `${field}.deviceId`), deviceClass };
}

export function parseGateCPlan(value: unknown): GateCPlanParseResult {
  try {
    if (!isRecord(value)) throw new TypeError("Gate C plan must be an object");
    if (value.schemaVersion !== 1) throw new TypeError("Gate C plan schemaVersion must be 1");
    if (value.planContractVersion !== "gate-c-plan-1") throw new TypeError("Gate C plan contract must be gate-c-plan-1");
    const reviewerIds = parseFixedReviewers(value.reviewerIds, "reviewerIds");
    if (!Array.isArray(value.devices) || value.devices.length !== 2) throw new TypeError("devices must contain exactly two planned devices");
    const devices: [GateCDevicePlan, GateCDevicePlan] = [parseDevice(value.devices[0], "devices[0]"), parseDevice(value.devices[1], "devices[1]")];
    if (devices[0].deviceId.trim().toLocaleLowerCase("en-US") === devices[1].deviceId.trim().toLocaleLowerCase("en-US")) throw new TypeError("planned device IDs must be distinct");
    if (!devices.some((device) => device.deviceClass === "mobile")) throw new TypeError("Gate C plan requires a mobile device");
    if (!Array.isArray(value.targets)) throw new TypeError("targets must be an array");
    const targets = value.targets.map((target, index) => parseTarget(target, `targets[${index}]`));
    uniqueTargets(targets, 4, "targets");
    return { ok: true, plan: { schemaVersion: 1, planContractVersion: "gate-c-plan-1", reviewerIds, devices, targets } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseGateCPlanJson(json: string): GateCPlanParseResult {
  try { return parseGateCPlan(JSON.parse(json) as unknown); }
  catch (error) { return { ok: false, error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` }; }
}
