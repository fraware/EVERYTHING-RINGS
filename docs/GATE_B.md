# Gate B — modal reconstruction

Gate B asks whether the estimated modal fingerprint is sufficient to reconstruct the perceptual identity of a struck object.

The baseline renderer is deliberately constrained. Each accepted mode contributes a sinusoid at its estimated frequency with its measured exponential decay. Relative modal amplitudes are compressed with a fixed exponent, a 3 ms half-cosine attack suppresses synthesis clicks, and the final waveform is peak-normalized. No recorded audio is mixed into the reconstruction.

## Validation protocol

For each Gate A object, compare the captured ringdown with the modal reconstruction at matched listening level. Include at least bell-like metal, glass, ceramic, and a weaker resonator. Reviewers should score object identity, brightness, decay character, and obvious missing or spurious modes without seeing which signal is which.

The numerical regression suite verifies deterministic output, attack continuity, measured decay preservation, and Nyquist filtering. Those checks are necessary but cannot establish perceptual equivalence.

Gate B passes only after blinded listening results show that the reconstruction preserves recognizable object identity across the validation set. Until then the renderer remains a candidate and must not define the consumer experience.
