# DSP contract

A microphone observes the object, impact, room, device transfer function, and noise together. EVERYTHING RINGS estimates **audible resonances in the recorded transient**. It does not claim to recover exact structural eigenmodes.

For a clean resonant decay, the working model is

\[
\hat{x}(t)=\sum_{k=1}^{K} A_k e^{-t/\tau_k}\cos(2\pi f_k t+\phi_k).
\]

Analysis operates at the actual capture sample rate. Algorithms receive `sampleRate` explicitly; no code may assume 48 kHz. Frequencies are stored in hertz and durations in seconds.

The baseline STFT uses an 8192-sample Hann window and 512-sample hop. Frame candidates must be local maxima and exceed an 8 dB local prominence threshold. Three-bin quadratic interpolation in log magnitude produces the sub-bin frequency estimate.

Peak tracking links frame candidates with a 25-cent tolerance plus a 3 Hz low-frequency guard, permits at most two empty frames, and assigns each track at most one peak per frame. A stable track initially requires at least eight observations, 80 ms duration, and at most 18 cents frequency standard deviation.

Decay fitting starts at the strongest reliable track observation and stops when prominence falls below 6 dB. Magnitude dB is converted to natural-log amplitude, then fitted against time with Huber iteratively reweighted least squares. Non-negative slopes are rejected. For a valid slope `s`, `decaySeconds = -1 / s` and `Q ≈ π f decaySeconds`.

These thresholds are configuration, not physical constants. A mode is accepted only after the later confidence layer combines persistence, stability, prominence, decay-fit quality, and noise evidence.
