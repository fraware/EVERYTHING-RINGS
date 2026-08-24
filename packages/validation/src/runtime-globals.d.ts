interface ValidationSubtleCrypto {
  digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
}

declare const crypto: {
  readonly subtle: ValidationSubtleCrypto;
};

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
