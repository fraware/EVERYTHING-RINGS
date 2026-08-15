# DSP contract

A microphone observes the object, impact, room, device transfer function, and noise together. EVERYTHING RINGS estimates **audible resonances in the recorded transient**. It does not claim to recover exact structural eigenmodes.

For a clean resonant decay, the working model is

\[
\hat{x}(t)=\sum_{k=1}^{K} A_k e^{-t/\tau_k}\cos(2\pi f_k t+\phi_k).
\]

Analysis operates at the actual capture sample rate. Algorithms receive `sampleRate` explicitly; no code may assume 48 kHz. Frequencies are stored in hertz and durations in seconds.

The baseline STFT uses an 8192-sample Hann window and 512-sample hop. Frame spectra are streamed through a callback so the production path does not retain a full spectrogram. Frame-level candidates must be local maxima and exceed an 8 dB local prominence threshold computed outside the immediate peak neighborhood. Three-bin quadratic interpolation in log magnitude produces the sub-bin frequency estimate.

Peak tracking links frame candidates with a 25-cent frequency tolerance plus a 3 Hz low-frequency guard, allows at most two empty frames, and assigns each track at most one peak per frame. Association uses an amplitude-weighted running frequency. A stable track initially requires at least eight observations, 80 ms duration, and at most 18 cents frequency standard deviation. These values are configuration, not physical constants.

A frame peak or a stable track is still only a candidate resonance. Decay fitting is the next acceptance layer.
