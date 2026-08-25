import { readFile } from "node:fs/promises";
import { sha256Digest } from "./sha256.ts";

export interface SourceFile {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly digest: string;
  readonly byteLength: number;
}

/**
 * Load a file and hash the exact on-disk bytes. Callers must parse from these
 * bytes and must not hash a reserialized form when reporting the original digest.
 */
export async function readSourceFile(path: string): Promise<SourceFile> {
  const bytes = await readFile(path);
  return {
    path,
    bytes,
    digest: await sha256Digest(bytes),
    byteLength: bytes.byteLength,
  };
}

export function decodeSourceUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function parseSourceJson(bytes: Uint8Array): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string } {
  let text: string;
  try {
    text = decodeSourceUtf8(bytes);
  } catch {
    return { ok: false, error: "file is not valid UTF-8" };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
}

export function sourceIntegrityFields(source: SourceFile) {
  return {
    path: source.path,
    digest: source.digest,
    byteLength: source.byteLength,
    sourceBytesHashed: true as const,
    reserialized: false as const,
  };
}
