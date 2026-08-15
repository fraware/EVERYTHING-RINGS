from pathlib import Path

path = Path("scripts/migrate-validation-v5.py")
text = path.read_text()
old = """    'Gate A2 passes at release level when at least five distinct physical specimen IDs have passing sessions and the passing set contains metal, glass, and ceramic objects.',
    'Gate A2 passes at release level when all imported sessions come from one software revision, at least five distinct physical specimen IDs have passing sessions, and the passing set contains metal, glass, and ceramic objects.',
"""
new = """    'Gate A2 passes at release level when at least **five distinct normalized `specimenId` values** have passing sessions and the passing specimen set contains metal, glass, and ceramic. Multiple passing sessions for one physical specimen still count as one specimen. Changing only an object label cannot increase release distinctness. Duplicate session IDs invalidate the release verdict. Reusing one normalized `specimenId` with conflicting material classes also invalidates the release-level verdict, including when the conflicting session itself fails physically.',
    'Gate A2 passes at release level when all imported sessions come from one software revision, at least **five distinct normalized `specimenId` values** have passing sessions, and the passing specimen set contains metal, glass, and ceramic. Multiple passing sessions for one physical specimen still count as one specimen. Changing only an object label cannot increase release distinctness. Duplicate session IDs invalidate the release verdict. Reusing one normalized `specimenId` with conflicting material classes also invalidates the release-level verdict, including when the conflicting session itself fails physically.',
"""
count = text.count(old)
assert count == 1, f"expected one migration assertion block, found {count}"
path.write_text(text.replace(old, new))
print("corrected Gate A migration assertion")
