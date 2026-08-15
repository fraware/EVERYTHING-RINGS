# Validation

Validation is a release requirement, not a demo aid.

The numerical foundation checks a 997 Hz synthetic sinusoid at both 44.1 kHz and 48 kHz using an 8192-sample Hann-windowed transform. Quadratic interpolation must recover the frequency within 1 Hz.

The first end-to-end golden fixture contains 440 Hz / 1.2 s, 997 Hz / 0.7 s, and 2413 Hz / 0.38 s decaying modes. `analyzeImpact()` must recover all three at both 44.1 and 48 kHz, with frequency error below max(3 Hz, 0.5%) and decay error below 15%. Silence must produce `NO_STABLE_RESONANCES`.

Planned adversarial cases add dense neighboring modes, broadband impulses, noise, clipping, and secondary impacts as their corresponding quality layers land.

Physical validation starts with strongly resonant positive controls: bell, wine glass, metal bowl, glass bottle, then ceramic mug. Repeated strikes under similar conditions must recover stable modal frequencies before consumer UI work proceeds.
