import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type ImmutableWriteResult = "inserted" | "idempotent";

export interface ByteStore {
  putImmutable(namespace: string, address: string, bytes: Uint8Array): Promise<ImmutableWriteResult>;
  getImmutable(namespace: string, address: string): Promise<Uint8Array | null>;
  listImmutable(namespace: string): Promise<readonly string[]>;
  putOverlay(namespace: string, id: string, bytes: Uint8Array): Promise<void>;
  getOverlay(namespace: string, id: string): Promise<Uint8Array | null>;
}

function addressFileName(address: string): string {
  if (!/^sha256:[0-9a-f]{64}$/.test(address) && !/^[a-z0-9._:-]+$/i.test(address)) {
    throw new Error(`refusing unsafe object key ${address}`);
  }
  return `${address.replaceAll(":", "-")}.json`;
}

function fileAddress(fileName: string): string {
  return fileName.replace(/\.json$/u, "").replace("sha256-", "sha256:");
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export class MemoryByteStore implements ByteStore {
  private readonly immutable = new Map<string, Uint8Array>();
  private readonly overlays = new Map<string, Uint8Array>();

  async putImmutable(namespace: string, address: string, bytes: Uint8Array): Promise<ImmutableWriteResult> {
    const key = `${namespace}/${address}`;
    const existing = this.immutable.get(key);
    if (existing !== undefined) {
      if (!bytesEqual(existing, bytes)) throw new Error(`immutable content-address collision in ${namespace}`);
      return "idempotent";
    }
    this.immutable.set(key, bytes);
    return "inserted";
  }

  async getImmutable(namespace: string, address: string): Promise<Uint8Array | null> {
    return this.immutable.get(`${namespace}/${address}`) ?? null;
  }

  async listImmutable(namespace: string): Promise<readonly string[]> {
    const prefix = `${namespace}/`;
    return [...this.immutable.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)).sort();
  }

  async putOverlay(namespace: string, id: string, bytes: Uint8Array): Promise<void> {
    this.overlays.set(`${namespace}/${id}`, bytes);
  }

  async getOverlay(namespace: string, id: string): Promise<Uint8Array | null> {
    return this.overlays.get(`${namespace}/${id}`) ?? null;
  }
}

export class FileByteStore implements ByteStore {
  constructor(private readonly rootDir: string) {}

  async putImmutable(namespace: string, address: string, bytes: Uint8Array): Promise<ImmutableWriteResult> {
    const directory = path.join(this.rootDir, "immutable", namespace);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, addressFileName(address));
    try {
      await writeFile(file, bytes, { flag: "wx" });
      return "inserted";
    } catch (error) {
      if (!isExistError(error)) throw error;
      const existing = await readFile(file);
      if (!bytesEqual(existing, bytes)) throw new Error(`immutable content-address collision in ${namespace}`);
      return "idempotent";
    }
  }

  async getImmutable(namespace: string, address: string): Promise<Uint8Array | null> {
    try {
      return await readFile(path.join(this.rootDir, "immutable", namespace, addressFileName(address)));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listImmutable(namespace: string): Promise<readonly string[]> {
    const directory = path.join(this.rootDir, "immutable", namespace);
    try {
      const files = await readdir(directory);
      return files.filter((file) => file.endsWith(".json")).map(fileAddress).sort();
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async putOverlay(namespace: string, id: string, bytes: Uint8Array): Promise<void> {
    const directory = path.join(this.rootDir, "overlays", namespace);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, addressFileName(id)), bytes);
  }

  async getOverlay(namespace: string, id: string): Promise<Uint8Array | null> {
    try {
      return await readFile(path.join(this.rootDir, "overlays", namespace, addressFileName(id)));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }
}

function isExistError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "EEXIST";
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "ENOENT";
}

export function createByteStore(rootDir: string | null): ByteStore {
  return rootDir === null ? new MemoryByteStore() : new FileByteStore(rootDir);
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

export function decodeJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}
