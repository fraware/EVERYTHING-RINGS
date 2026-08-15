# Acoustic DNA

Acoustic DNA is the deterministic visual identity derived from an `AcousticFingerprintV1`. It is an encoding of measured modal structure, not an independent aesthetic layer.

Each accepted resonance maps to four visual quantities. Log frequency controls radius. Pitch class controls angle. Confidence-weighted relative amplitude controls intensity. Measured decay controls persistence. The encoding is normalized and versioned so the same fingerprint produces the same geometry across the browser, share artifacts, and future Atlas views.

Every fingerprint also receives a compact `er1-…` signature computed from quantized frequency, decay, amplitude, and confidence values sorted by frequency. The signature is intended as a stable display identity for this encoding version. It is not a cryptographic digest and should not be used as an authentication primitive.

Changes to the visual mapping or signature quantization require a new encoding version. Presentation code may animate or style the geometry, but must not change the underlying coordinates when representing the same Acoustic DNA version.
