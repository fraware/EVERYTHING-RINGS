/**
 * SHA-256 of exact bytes. Never JSON.stringify, canonicalize, or otherwise
 * reserialize the input. Source-evidence digests must be of the original file.
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Digest(bytes: Uint8Array): Promise<string> {
  return `sha256:${await sha256Hex(bytes)}`;
}
