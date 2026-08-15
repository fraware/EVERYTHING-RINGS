# DSP contract

The signal is modeled as an observed transient containing object response, impact excitation, room response, device response, and noise. Estimated modes are audible resonant partials, not guaranteed structural eigenmodes.

All physical quantities carry units in their identifiers. Every function receives the native sample rate explicitly; no algorithm assumes 48 kHz.

Before spectral analysis, a coarse impact location is refined by maximizing the short-window energy rise within a bounded neighborhood. Resonance analysis starts 15 ms after the refined onset so pre-trigger room noise and the broadband collision do not seed modal tracks.

The baseline spectral estimator uses an 8192-sample Hann-windowed real FFT around common mobile sample rates. Spectral maxima are estimated between bins with quadratic interpolation over log magnitude. This is the transparent regression reference before any higher-resolution estimator is considered.

Frame peaks require local prominence and are linked through time using cents distance. Short gaps may be bridged; long gaps close tracks. Stable tracks require sufficient persistence, observations, and low frequency variance.

Decay is estimated only after the track reaches its maximum reliable amplitude. Magnitudes are converted to log amplitude and fit against time with Huber iteratively reweighted least squares. A valid fit must have a negative slope; the amplitude decay constant is `tau = -1 / slope` and `Q ≈ π f tau`.

`analyzeImpact()` combines the accepted tracks into `AcousticFingerprintV1`. Confidence combines prominence, decay-fit quality, persistence, and frequency stability. Near-duplicate candidates are suppressed before ranking. The initial contract exposes at most 16 modes and requires at least three to call a capture a stable fingerprint.
