declare const process: {
  readonly argv: readonly string[];
  readonly execPath: string;
  exitCode: number | undefined;
  readonly stdout: { write(data: string): boolean | void };
  readonly stderr: { write(data: string): boolean | void };
};

declare module "node:fs/promises" {
  export function readFile(path: string): Promise<Uint8Array>;
  export function writeFile(path: string, data: string | Uint8Array): Promise<void>;
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function access(path: string): Promise<void>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
  export function basename(path: string): string;
}

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}

declare module "node:child_process" {
  export function spawn(
    command: string,
    args: readonly string[],
    options?: { cwd?: string; env?: unknown },
  ): {
    readonly stdout: { on(event: "data", listener: (chunk: Uint8Array) => void): void };
    readonly stderr: { on(event: "data", listener: (chunk: Uint8Array) => void): void };
    on(event: "error", listener: (error: Error) => void): void;
    on(event: "close", listener: (code: number | null) => void): void;
  };
}

