from pathlib import Path

path = Path("scripts/migrate-validation-v5.py")
text = path.read_text()

old_gate = """    'Gate A2 passes at release level when at least five distinct physical specimen IDs have passing sessions and the passing set contains metal, glass, and ceramic objects.',
    'Gate A2 passes at release level when all imported sessions come from one software revision, at least five distinct physical specimen IDs have passing sessions, and the passing set contains metal, glass, and ceramic objects.',
"""
new_gate = """    'Gate A2 passes at release level when at least **five distinct normalized `specimenId` values** have passing sessions and the passing specimen set contains metal, glass, and ceramic. Multiple passing sessions for one physical specimen still count as one specimen. Changing only an object label cannot increase release distinctness. Duplicate session IDs invalidate the release verdict. Reusing one normalized `specimenId` with conflicting material classes also invalidates the release-level verdict, including when the conflicting session itself fails physically.',
    'Gate A2 passes at release level when all imported sessions come from one software revision, at least **five distinct normalized `specimenId` values** have passing sessions, and the passing specimen set contains metal, glass, and ceramic. Multiple passing sessions for one physical specimen still count as one specimen. Changing only an object label cannot increase release distinctness. Duplicate session IDs invalidate the release verdict. Reusing one normalized `specimenId` with conflicting material classes also invalidates the release-level verdict, including when the conflicting session itself fails physically.',
"""
count = text.count(old_gate)
assert count == 1, f"expected one Gate A migration assertion block, found {count}"
text = text.replace(old_gate, new_gate)

ci_block = """replace_once(
    '.github/workflows/ci.yml',
    '  validate:\\n    runs-on: ubuntu-latest\\n    steps:',
    '  validate:\\n    runs-on: ubuntu-latest\\n    env:\\n      VITE_SOFTWARE_REVISION: ${{ github.sha }}\\n    steps:',
)
"""
pages_block = """replace_once(
    '.github/workflows/pages.yml',
    '  build:\\n    runs-on: ubuntu-24.04\\n    needs: pages-status',
    '  build:\\n    runs-on: ubuntu-24.04\\n    env:\\n      VITE_SOFTWARE_REVISION: ${{ github.sha }}\\n    needs: pages-status',
)
"""
for label, block in (("ci workflow migration", ci_block), ("pages workflow migration", pages_block)):
    count = text.count(block)
    assert count == 1, f"expected one {label} block, found {count}"
    text = text.replace(block, "")

path.write_text(text)
print("corrected Gate A assertion and skipped connector-applied workflow transforms")
