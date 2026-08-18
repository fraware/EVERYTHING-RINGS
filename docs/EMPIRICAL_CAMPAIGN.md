# Empirical campaign contract

The release gates answer whether collected evidence satisfies frozen technical and perceptual thresholds. They do not, by themselves, prove that the set of tested objects was chosen without outcome-dependent substitution. `empirical-campaign-1` adds that collection-integrity layer.

A campaign manifest is frozen before physical collection. It names each physical specimen, its material, cohort, object family, exact fixed setup, target number of sessions, and the exact authorized software revision. The manifest receives a deterministic `erc1-*` signature. Changing any scientific field changes the signature.

The campaign contract does **not** weaken or replace Gate A2, Gate B, or Gate C. A campaign can be completely accounted for while containing analytical failures or Gate A2 failures. That distinction is intentional.

## Why precommit the specimen set

A measurement pipeline can look artificially reliable if difficult objects are abandoned after poor results and easier replacements are added. The campaign evaluator therefore keeps four categories visible:

- planned specimens with no collected session;
- planned sessions whose object identity, software revision, setup, or five-attempt contract differs from the manifest;
- evidence for specimens absent from the manifest;
- specimens with more sessions than were precommitted.

A conforming session remains collected even when one or more of its qualified attempts fail analytically. Failed analytical attempts remain part of the campaign outcome and cannot be replaced by another physical specimen or an extra unplanned session.

## Manifest-bound collection workflow

The dedicated web route `?campaign=1` is the collection surface for a precommitted campaign. It is deliberately narrower than the general validation lab.

1. Load the frozen `empirical-campaign-1` JSON manifest.
2. Confirm that the manifest's exact 40-hex `authorizedSoftwareRevision` matches the running build. The collector will not arm a mismatch or an unstamped build.
3. Select one specimen from the manifest. The collector loads its specimen ID, label, material, microphone distance, striker, strike location, and support condition directly from the manifest. There are no editable overrides in campaign mode.
4. If `targetSessions` is greater than one, choose the precommitted session ordinal being collected.
5. Arm the session and collect the same frozen five acquisition-quality-passing attempts used by Gate A2. Every qualified analytical success or failure occupies its slot.
6. Export the evidence. Do not collect a sixth attempt after the five-attempt session closes.
7. Close the planned session and move to the next manifest specimen or precommitted session ordinal.
8. Import the campaign plus all exported evidence bundles into `?release=1` for campaign accounting and Gate A2/B/C evaluation.

The campaign collector does not host Gate B or Gate C review. Those later perceptual workflows remain in the general validation lab so physical collection stays separated from downstream review.

An internal session failure terminates the physical session. Export retained evidence. Restarting the same specimen creates another session, and campaign accounting will expose the additional or incomplete session instead of silently replacing the failure.

## Recommended first campaign

The first serious physical characterization campaign should be larger than the five-specimen release minimum. A practical target is **12 physical specimens**, split into two predeclared cohorts.

### Release-core cohort — 6 specimens

Select ordinary objects expected to produce usable impacts while covering the release-critical materials and additional everyday structure. A strong composition is:

- 2 metal specimens from different object families;
- 2 glass specimens from different object families;
- 2 ceramic specimens from different object families.

These six are the cleanest test of repeatable resonance recovery under the fixed setup. Do not select them based on a successful trial run through the production analysis pipeline.

### Challenge cohort — 6 specimens

Select specimens specifically because they probe known or plausible failure boundaries. The recommended challenge classes are:

1. a strongly damped wood object with short audible decay;
2. a plastic or polymer object with weak, broad resonant structure;
3. a heterogeneous or composite object with multiple coupled parts;
4. a high-Q glass or metal object with long decay and closely spaced peaks;
5. a small or weakly radiating object near the microphone/SNR floor;
6. an object with geometry likely to produce near-degenerate or strike-location-sensitive modes.

These labels describe selection criteria, not predicted outcomes. The exact physical specimen IDs, object labels, and fixed setups are entered only when the real objects have been selected.

## Session policy

For the first campaign, use `targetSessions: 1` unless a cross-session repeatability question has been explicitly precommitted. Each session still contains the frozen five qualified attempts required by Gate A2.

If cross-session repeatability is a research objective, set `targetSessions` above one in the manifest before collection. Do not add a replacement session after observing a poor first session unless that replacement was already part of the target count. Evidence beyond the precommitted session count is flagged as overcollection.

## Fixed setup

Each planned specimen commits:

- microphone distance in centimeters;
- striker;
- strike location;
- support condition.

The campaign collector loads those fields directly and does not expose editable overrides. The Release Console independently compares imported evidence against the same manifest values. A changed setup remains visible as nonconforming evidence instead of being silently pooled with the planned session.

## Software binding

The manifest contains one exact 40-hex `authorizedSoftwareRevision`. Conforming campaign sessions must use that revision. This ensures the specimen plan is evaluated against one frozen implementation and prevents an algorithm or UI revision from being mixed into the same collection without an explicit new campaign.

## Campaign completion versus scientific success

`collectionComplete` means every planned specimen has exactly its precommitted number of conforming five-attempt sessions and no unplanned specimen evidence is present. It says nothing about whether those sessions pass Gate A2.

The campaign report separately exposes:

- conforming complete sessions;
- Gate A2-passing sessions;
- analytical failures retained inside planned-specimen sessions;
- material coverage;
- missing, mismatched, overcollected, and unplanned specimens.

That separation makes a negative result scientifically useful. A fully accounted campaign with many failures is a real characterization result and should guide the next algorithm version instead of being edited into a release pass.

## Example manifest shape

```json
{
  "schemaVersion": 1,
  "campaignContractVersion": "empirical-campaign-1",
  "campaignId": "physical-campaign-001",
  "createdAt": "2026-08-18T00:00:00.000Z",
  "authorizedSoftwareRevision": "0123456789abcdef0123456789abcdef01234567",
  "specimens": [
    {
      "specimenId": "metal-bell-01",
      "label": "small brass bell",
      "material": "metal",
      "cohort": "release-core",
      "objectFamily": "bell",
      "targetSessions": 1,
      "protocol": {
        "fixedSetup": true,
        "microphoneDistanceCm": 20,
        "striker": "wooden dowel",
        "strikeLocation": "marked rim point",
        "supportCondition": "suspended at handle"
      }
    }
  ]
}
```

The example is schema documentation only. It is not a valid substitute for selecting and precommitting the real physical campaign.
