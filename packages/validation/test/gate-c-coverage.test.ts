import { describe, expect, it } from "vitest";
import { evaluateGateARelease, evaluateGateBRelease, evaluateGateCRelease } from "../src";
import { fiveObjects, gateBReview, gateCReview } from "./helpers";

function passingGateB() {
  const bundles = fiveObjects();
  const gateA = evaluateGateARelease(bundles);
  const labels = bundles.map((bundle) => bundle.object.label);
  return evaluateGateBRelease(
    gateA,
    labels.flatMap((label) => [gateBReview(label, "r1"), gateBReview(label, "r2")]),
  );
}

describe("Gate C release device coverage", () => {
  it("does not use a failed object's mobile review to satisfy release device diversity", () => {
    const gateB = passingGateB();
    const labels = gateB.objects.filter((object) => object.passed).map((object) => object.objectLabel);
    const passingDesktopReviews = labels.slice(0, 4).map((label, index) =>
      gateCReview(label, "desktop-1", "desktop", { reviewerId: `desktop-${index}` }),
    );
    const failedMobileReview = gateCReview(labels[4] ?? "ceramic mug", "mobile-1", "mobile", {
      reviewerId: "mobile-failed-object",
      identityAcrossRange: 1,
      timbreContinuity: 1,
      usefulSemitoneSpan: 0,
    });

    const verdict = evaluateGateCRelease(gateB, [...passingDesktopReviews, failedMobileReview]);
    expect(verdict.passingSpecimenCount).toBe(4);
    expect(verdict.passed).toBe(false);
    expect(verdict.distinctDeviceCount).toBe(1);
    expect(verdict.hasMobileDevice).toBe(false);
    expect(verdict.reasons.some((reason) => reason.includes("2 distinct devices"))).toBe(true);
    expect(verdict.reasons.some((reason) => reason.includes("mobile-device"))).toBe(true);
  });

  it("counts mobile coverage when the mobile review belongs to a Gate C-passing object", () => {
    const gateB = passingGateB();
    const labels = gateB.objects.filter((object) => object.passed).map((object) => object.objectLabel);
    const reviews = labels.slice(0, 4).flatMap((label, index) => [
      gateCReview(label, "desktop-1", "desktop", { reviewerId: `desktop-${index}` }),
      ...(index === 0 ? [gateCReview(label, "mobile-1", "mobile", { reviewerId: "mobile-passing-object" })] : []),
    ]);

    const verdict = evaluateGateCRelease(gateB, reviews);
    expect(verdict.passed).toBe(true);
    expect(verdict.distinctDeviceCount).toBe(2);
    expect(verdict.hasMobileDevice).toBe(true);
  });
});
