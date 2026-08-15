# DSP contract

The signal is modeled as an observed transient containing object response, impact excitation, room response, device response, and noise. Estimated modes are audible resonant partials, not guaranteed structural eigenmodes.

All physical quantities carry units in their identifiers. Every function receives the native sample rate explicitly; no algorithm assumes 48 kHz.

Before spectral analysis, a coarse impact location is refined by maximizing the short-window energy rise within a bounded neighborhood. Resonance analysis starts 15 ms after the refined onset so pre-trigger room noise and the broadband collision do not seed modal tracks.

The baseline spectral estimator uses an 8192-sample Hann-windowed real FFT around common mobile sample rates. Spectral maxima are estimated between bins with quadratic interpolation over log magnitude. This is the transparent regression reference before any higher-resolution estimator is considered.

Frame peaks require local prominence and are linked through time using cents distance. Short gaps may be bridged; long gaps close tracks. Stable tracks require sufficient persistence, observations, and low frequency variance.

Decay is estimated only after the track reaches its maximum reliable amplitude. Magnitudes are converted to log amplitude and fit against time with Huber iteratively reweighted least squares. A valid fit must have a negative slope; the amplitude decay constant is `tau = -1 / slope` and `Q ≈ π f tau`.

`analyzeImpact()` is the canonical, evidence-eligible analysis entry point. It runs the frozen default parameterization and stamps the resulting `AcousticFingerprintV1` with the current algorithm version. `analyzeImpactWithConfig()` is reserved for research and diagnostics: it accepts explicit estimator parameters but returns an intentionally unversioned fingerprint, so custom configurations cannot masquerade as canonical validation evidence.

Confidence combines prominence, decay-fit quality, persistence, and frequency stability. `er-dsp-2` adds a measurement-support floor: a stable track must reach at least `0.001` of the strongest accepted-track amplitude (-60 dB) to enter the reported modal set. This prevents persistent numerical, device, or browser-noise tracks far below the observed response from being presented as audible resonances. `er-dsp-1` identifies the historical estimator without this selection rule; historical evidence remains tied to the exact software revision that produced it. Near-duplicate candidates are suppressed before ranking. The contract exposes at most 16 modes and requires at least three to call a capture a stable fingerprint.
