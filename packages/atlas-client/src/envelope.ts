export const ATLAS_HTTP_CONTRACT_VERSION = "resonance-atlas-http-1" as const;
export const ATLAS_SERVICE_CONTRACT_VERSION = "resonance-atlas-service-1" as const;
export const ATLAS_RUNTIME_STAGE = "alpha-synthetic" as const;

export interface AtlasHttpSuccessV1<T> {
  readonly contractVersion: string;
  readonly httpContractVersion: typeof ATLAS_HTTP_CONTRACT_VERSION;
  readonly contentAddress: string;
  readonly stage: typeof ATLAS_RUNTIME_STAGE;
  readonly publicNetwork: false;
  readonly body: T;
}

export interface AtlasHttpErrorV1 {
  readonly contractVersion: typeof ATLAS_HTTP_CONTRACT_VERSION;
  readonly httpContractVersion: typeof ATLAS_HTTP_CONTRACT_VERSION;
  readonly contentAddress: string;
  readonly stage: typeof ATLAS_RUNTIME_STAGE;
  readonly publicNetwork: false;
  readonly error: {
    readonly status: number;
    readonly code: string;
    readonly message: string;
  };
}

export function isAtlasHttpError(value: unknown): value is AtlasHttpErrorV1 {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.error !== undefined && typeof record.error === "object";
}
