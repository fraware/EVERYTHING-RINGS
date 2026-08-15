const cache = new Map<number, Float32Array>();

export function hannWindow(size: number): Float32Array {
  if (!Number.isInteger(size) || size < 2) {
    throw new RangeError(`Window size must be an integer >= 2; received ${size}`);
  }

  const cached = cache.get(size);
  if (cached !== undefined) return cached;

  const window = new Float32Array(size);
  const denominator = size - 1;
  for (let sampleIndex = 0; sampleIndex < size; sampleIndex += 1) {
    window[sampleIndex] = 0.5 * (1 - Math.cos((2 * Math.PI * sampleIndex) / denominator));
  }

  cache.set(size, window);
  return window;
}
