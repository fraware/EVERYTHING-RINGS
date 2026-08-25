/**
 * Publication UX contract for observation-level Atlas publication.
 * Local capture succeeds first; publish is a separate explicit action.
 */
export interface AtlasPublicationPreviewV1 {
  readonly localCaptureFirst: true;
  readonly publishIsExplicit: true;
  readonly rawAudioIncludedByDefault: false;
  readonly canonicalObjectIdentityRequired: false;
  readonly metadataThatLeavesTheDevice: readonly string[];
  readonly metadataThatStaysOnDevice: readonly string[];
}

export function describeAtlasPublicationPreview(): AtlasPublicationPreviewV1 {
  return {
    localCaptureFirst: true,
    publishIsExplicit: true,
    rawAudioIncludedByDefault: false,
    canonicalObjectIdentityRequired: false,
    metadataThatLeavesTheDevice: [
      "measurement content address",
      "optional contributor display name",
      "optional object-family or tags",
      "publication timestamp",
      "publication consent flag",
    ],
    metadataThatStaysOnDevice: [
      "raw microphone samples (PCM)",
      "exact device identifiers unless separately consented",
      "fine-grained location",
    ],
  };
}
