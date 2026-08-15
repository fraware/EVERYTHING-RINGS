# Validation

Validation is a release requirement, not a demo aid.

The first numerical gate checks a 997 Hz synthetic sinusoid at both 44.1 kHz and 48 kHz using an 8192-sample Hann-windowed transform. Quadratic interpolation must recover the frequency within 1 Hz. The fixture generator uses seeded noise so regression cases are reproducible.

Planned golden cases cover isolated decaying modes, dense neighboring modes, a broadband dead impulse, noise only, hard clipping, and a secondary impact.

Physical validation starts with strongly resonant positive controls: bell, wine glass, metal bowl, glass bottle, then ceramic mug. Repeated strikes under similar conditions must recover stable modal frequencies before consumer UI work proceeds.
