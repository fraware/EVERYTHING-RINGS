# Security and privacy reporting

EVERYTHING RINGS handles microphone access locally in the browser and intentionally separates microphone PCM from shareable evidence artifacts. Security reports that could affect microphone privacy, evidence integrity, provenance binding, artifact parsing, or release-gate correctness are treated as high priority.

## Report scope

Please report privately before public disclosure when an issue could:

- cause microphone capture to continue after stop, cancellation, page departure, or ownership transfer;
- upload, persist, or disclose raw microphone samples outside an explicitly local/private path;
- bypass evidence schema validation or revision/algorithm binding;
- forge, substitute, or mismatch Gate B listening companions or provenance digests;
- cause the Release Console to accept an incomplete or non-canonical empirical matrix;
- execute untrusted content through imported evidence, campaign, review-plan, Capsule, or future Atlas artifacts;
- compromise content-addressed measurement or derivation integrity.

## Reporting

Use GitHub's private vulnerability reporting facility for this repository when enabled. If that facility is not enabled, contact the repository owner through a private channel rather than publishing exploit details in a public issue.

Include the affected revision, browser/runtime, reproduction steps, expected and actual behavior, and whether microphone data or release evidence may have been exposed or misclassified.

## Claim discipline

A software security fix does not retroactively validate physical evidence. Changes to an empirical authority revision require the project's normal revision-binding and requalification process before new physical evidence is accepted.
