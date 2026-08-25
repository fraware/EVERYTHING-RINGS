const PCM_KEYS = new Set([
  "pcm",
  "samples",
  "audioSamples",
  "microphoneSamples",
  "rawAudio",
  "rawMicrophoneSamples",
  "wavBytes",
  "audioBuffer",
]);

export function artifactContainsPcm(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "object") return false;
  if (ArrayBuffer.isView(value)) return true;
  if (Array.isArray(value)) return value.some(artifactContainsPcm);
  const record = value as Record<string, unknown>;
  if (record.rawMicrophoneSamplesIncluded === true) return true;
  for (const [key, nested] of Object.entries(record)) {
    if (PCM_KEYS.has(key) && nested !== undefined && nested !== null && nested !== false) return true;
    if (artifactContainsPcm(nested)) return true;
  }
  return false;
}
