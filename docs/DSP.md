# DSP contract

The signal is modeled as an observed transient containing object response, impact excitation, room response, device response, and noise. Estimated modes are audible resonant partials, not guaranteed structural eigenmodes.

All physical quantities carry units in their identifiers. Every function receives the native sample rate explicitly; no algorithm assumes 48 kHz.

Before spectral analysis, a coarse impact location is refined by maximizing the short-window energy rise within a bounded neighborhood. Resonance analysis starts 15 ms after the refined onset so pre-trigger room noise and the broadband collision do not seed modal tracks.

The baseline spectral estimator uses an 8192-sample Hann-windowed real FFT around common mobile sample rates. Spectral maxima are estimated between bins with quadratic interpolation over log magnitude. This is the transparent regression reference before any higher-resolution estimator is considered.

Frame peaks require local prominence and are linked through time using cents distance. Short gaps may be bridged; long gaps close tracks. Stable tracks require sufficient persistence, observations, and low frequency variance.

Decay is estimated only after the track reaches its maximum reliable amplitude. Magnitudes are converted to log amplitude and fit against time with Huber iteratively reweighted least squares. A valid fit must have a negative slope; the amplitude decay constant is `tau = -1 / slope` and `Q ≈ π f tau`.

`analyzeImpact()` is the canonical, evidence-eligible analysis entry point. It runs the frozen default parameterization and stamps the resulting `AcousticFingerprintV1` with the current algorithm version. `analyzeImpactWithConfig()` is reserved for research and diagnostics: it accepts explicit estimator parameters but returns an intentionally unversioned fingerprint, so custom configurations cannot masquerade as canonical validation evidence.

## Research estimators and promotion protocol

`er-dsp-2` remains the current evidence-eligible fingerprint algorithm. `analyzeImpact()` is the only analysis entry point that stamps `algorithmVersion` on an `AcousticFingerprintV1`. `analyzeImpactWithConfig()` returns an unversioned diagnostic fingerprint. Research estimators, currently `prony-damped-modes-research-1` via `estimateDampedModesWithResearchEstimator()`, never produce an `AcousticFingerprintV1`, never stamp `algorithmVersion`, and always set `evidenceEligible: false`.

A synthetic `er-dsp-2` failure-map suite documents known FFT / peak-tracking / decay-fitting failure regimes: close or overlapping modes, near-degenerate pairs, short decay, broad resonances, coupled clusters, and low SNR. Failure-map reports use contract `er-dsp-2-failure-map-1` with `evidenceEligible: false` and `releaseGateEquivalent: false`. They are research diagnostics, not release gates, and they do not introduce a new algorithm version.

Promotion of a candidate estimator to a new canonical algorithm version requires all of the following:

1. exact algorithm specification;
2. frozen configuration;
3. synthetic benchmark pass;
4. physical benchmark pre-registration;
5. specimen-disjoint held-out evaluation;
6. no silent regression on currently supported regimes;
7. explicit improvement on at least one targeted failure regime;
8. a new fingerprint algorithm version;
9. a migration and compatibility policy across `er-dsp-2` and the candidate;
10. a new empirical qualification cycle before evidence from the candidate is called release evidence.

Do not merge fingerprints from different algorithm versions into one object model unless an explicit cross-version normalization method has itself been validated. This document does not claim or assign a new algorithm version.

Confidence combines prominence, decay-fit quality, persistence, and frequency stability. `er-dsp-2` adds a measurement-support floor: a stable track must reach at least `0.001` of the strongest accepted-track amplitude (-60 dB) to enter the reported modal set. This prevents persistent numerical, device, or browser-noise tracks far below the observed response from being presented as audible resonances. `er-dsp-1` identifies the historical estimator without this selection rule; historical evidence remains tied to the exact software revision that produced it. Near-duplicate candidates are suppressed before ranking. The contract exposes at most 16 modes and requires at least three to call a capture a stable fingerprint.
