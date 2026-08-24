export interface ResearchDampedModeEstimateV1 {
  readonly frequencyHz: number;
  readonly decaySeconds: number;
  readonly poleRadius: number;
  readonly poleAngleRadians: number;
}

export interface PronyResearchResultV1 {
  readonly researchEstimatorVersion: "prony-damped-modes-research-1";
  readonly evidenceEligible: false;
  readonly requestedModeCount: number;
  readonly modes: readonly ResearchDampedModeEstimateV1[];
  readonly residualRms: number;
}

interface Complex {
  re: number;
  im: number;
}

function cadd(a: Complex, b: Complex): Complex { return { re: a.re + b.re, im: a.im + b.im }; }
function csub(a: Complex, b: Complex): Complex { return { re: a.re - b.re, im: a.im - b.im }; }
function cmul(a: Complex, b: Complex): Complex { return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }; }
function cdiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (!(d > 0)) return { re: Number.POSITIVE_INFINITY, im: Number.POSITIVE_INFINITY };
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cabs(a: Complex): number { return Math.hypot(a.re, a.im); }

function solveLinearSystem(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, index) => [...row, rhs[index]!]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row]![column]!) > Math.abs(a[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(a[pivot]![column]!) < 1e-14) throw new Error("Prony normal equations are singular");
    [a[column], a[pivot]] = [a[pivot]!, a[column]!];
    const scale = a[column]![column]!;
    for (let j = column; j <= n; j += 1) a[column]![j] = a[column]![j]! / scale;
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row]![column]!;
      if (factor === 0) continue;
      for (let j = column; j <= n; j += 1) a[row]![j] = a[row]![j]! - factor * a[column]![j]!;
    }
  }
  return a.map((row) => row[n]!);
}

function linearPredictionCoefficients(samples: readonly number[], order: number): number[] {
  const normal = Array.from({ length: order }, () => Array<number>(order).fill(0));
  const rhs = Array<number>(order).fill(0);
  for (let n = order; n < samples.length; n += 1) {
    const target = -samples[n]!;
    for (let i = 0; i < order; i += 1) {
      const xi = samples[n - i - 1]!;
      rhs[i] = rhs[i]! + xi * target;
      for (let j = 0; j < order; j += 1) normal[i]![j] = normal[i]![j]! + xi * samples[n - j - 1]!;
    }
  }
  const trace = normal.reduce((sum, row, index) => sum + Math.abs(row[index] ?? 0), 0);
  const ridge = Math.max(1e-14, trace * 1e-12 / Math.max(1, order));
  for (let index = 0; index < order; index += 1) normal[index]![index] = normal[index]![index]! + ridge;
  return solveLinearSystem(normal, rhs);
}

function polynomialValue(coefficients: readonly number[], z: Complex): Complex {
  let value: Complex = { re: coefficients[0]!, im: 0 };
  for (let index = 1; index < coefficients.length; index += 1) {
    value = cadd(cmul(value, z), { re: coefficients[index]!, im: 0 });
  }
  return value;
}

function durandKerner(coefficients: readonly number[]): Complex[] {
  const degree = coefficients.length - 1;
  if (degree < 1) return [];
  let roots = Array.from({ length: degree }, (_, index) => {
    const angle = 2 * Math.PI * (index + 0.37) / degree;
    return { re: 0.9 * Math.cos(angle), im: 0.9 * Math.sin(angle) };
  });
  for (let iteration = 0; iteration < 300; iteration += 1) {
    let maximumStep = 0;
    const next = roots.map((root, index) => {
      let denominator: Complex = { re: 1, im: 0 };
      for (let other = 0; other < roots.length; other += 1) {
        if (other === index) continue;
        denominator = cmul(denominator, csub(root, roots[other]!));
      }
      if (cabs(denominator) < 1e-18) denominator = cadd(denominator, { re: 1e-12, im: 1e-12 });
      const step = cdiv(polynomialValue(coefficients, root), denominator);
      maximumStep = Math.max(maximumStep, cabs(step));
      return csub(root, step);
    });
    roots = next;
    if (maximumStep < 1e-11) break;
  }
  return roots;
}

function residualRms(samples: readonly number[], coefficients: readonly number[]): number {
  const order = coefficients.length;
  let squared = 0;
  let count = 0;
  for (let n = order; n < samples.length; n += 1) {
    let prediction = 0;
    for (let index = 0; index < order; index += 1) prediction -= coefficients[index]! * samples[n - index - 1]!;
    squared += (samples[n]! - prediction) ** 2;
    count += 1;
  }
  return count === 0 ? 0 : Math.sqrt(squared / count);
}

/**
 * Research-only Prony/linear-prediction estimator for synthetic close-mode experiments.
 * It is intentionally not an AcousticFingerprintV1 producer and is never evidence-eligible.
 */
export function estimateDampedModesPronyResearch(
  samples: readonly number[],
  sampleRate: number,
  modeCount: number,
): PronyResearchResultV1 {
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) throw new Error("sampleRate must be finite and positive");
  if (!Number.isInteger(modeCount) || modeCount <= 0 || modeCount > 12) throw new Error("modeCount must be an integer in [1,12]");
  const order = 2 * modeCount;
  if (samples.length < Math.max(32, order * 8)) throw new Error("insufficient samples for Prony research estimator");
  if (samples.some((value) => !Number.isFinite(value))) throw new Error("Prony samples must be finite");

  const coefficients = linearPredictionCoefficients(samples, order);
  const roots = durandKerner([1, ...coefficients]);
  const modes = roots
    .map((root) => {
      const radius = cabs(root);
      const angle = Math.atan2(root.im, root.re);
      if (!(angle > 0 && angle < Math.PI) || !(radius > 0 && radius < 1.0005)) return null;
      const frequencyHz = angle * sampleRate / (2 * Math.PI);
      const safeRadius = Math.min(radius, 0.999999999);
      const decaySeconds = -1 / (sampleRate * Math.log(safeRadius));
      if (!(frequencyHz > 0 && frequencyHz < sampleRate / 2) || !(decaySeconds > 0) || !Number.isFinite(decaySeconds)) return null;
      return { frequencyHz, decaySeconds, poleRadius: radius, poleAngleRadians: angle };
    })
    .filter((mode): mode is ResearchDampedModeEstimateV1 => mode !== null)
    .sort((left, right) => left.frequencyHz - right.frequencyHz)
    .slice(0, modeCount);

  return {
    researchEstimatorVersion: "prony-damped-modes-research-1",
    evidenceEligible: false,
    requestedModeCount: modeCount,
    modes,
    residualRms: residualRms(samples, coefficients),
  };
}
