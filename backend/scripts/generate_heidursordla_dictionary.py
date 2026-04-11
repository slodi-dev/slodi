"""
Generate the Heiðursorðla 5-letter Icelandic word list from BÍN via the
``islenska`` package, and write it to ``backend/app/data/icelandic_5_letter_words.txt``.

This is a one-shot generator. The runtime backend has **no** dependency on
``islenska``; it loads the committed text file at startup into a frozenset.
Re-run this script (and commit the regenerated file) when the BÍN snapshot
shipped with ``islenska`` is updated.

Strategy
--------
The public ``islenska.Bin`` API is lookup-only — there is no enumeration
method exposing every lemma or form. Instead, we brute-force the 32-letter
Icelandic alphabet (32^5 = 33,554,432 candidates) through the fast
DAWG-backed ``Bin.contains()`` check, then filter the survivors to entries
with ``hluti='alm'`` (general vocabulary), excluding ``ism`` (person names)
and ``örn`` (place names). All retained words are NFC-normalized.

Phase 1 (DAWG ``contains``) takes ~30s on a laptop; phase 2 (per-hit
``lookup``) is the slower step. Expect a final list size of ~25,000 words.

Usage
-----
Add ``islenska`` to the dev dependency group, then::

    cd backend
    PYTHONPATH=. uv run --group dev python scripts/generate_heidursordla_dictionary.py

License
-------
The BÍN data shipped with ``islenska`` is released under CC BY-SA 4.0.
The output file inherits that license — keep the attribution alongside it.
"""

from __future__ import annotations

import time
import unicodedata
from pathlib import Path

from islenska import Bin

ALPHABET = "aábdðeéfghiíjklmnoóprstuúvxyýþæö"
WORD_LENGTH = 5
OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent / "app" / "data" / "icelandic_5_letter_words.txt"
)


def main() -> None:
    assert len(ALPHABET) == 32, f"expected 32 Icelandic letters, got {len(ALPHABET)}"

    b = Bin()
    total = len(ALPHABET) ** WORD_LENGTH

    # ── Phase 1: brute-force DAWG membership ────────────────────────────
    print(f"Phase 1: scanning {total:,} candidates via Bin.contains()")
    start = time.time()
    hits: list[str] = []
    checked = 0
    progress_every = 2_000_000

    for c1 in ALPHABET:
        for c2 in ALPHABET:
            for c3 in ALPHABET:
                for c4 in ALPHABET:
                    for c5 in ALPHABET:
                        w = c1 + c2 + c3 + c4 + c5
                        if b.contains(w):
                            hits.append(w)
                        checked += 1
                        if checked % progress_every == 0:
                            elapsed = time.time() - start
                            rate = checked / elapsed
                            eta = (total - checked) / rate
                            pct = 100 * checked / total
                            print(
                                f"  {checked:>11,} / {total:,} ({pct:5.1f}%)  "
                                f"rate={rate / 1000:>5.0f}k/s  eta={eta:>5.0f}s  "
                                f"hits={len(hits):,}"
                            )

    phase1_seconds = time.time() - start
    print(f"\nPhase 1 done in {phase1_seconds:.1f}s. Total contains() hits: {len(hits):,}")

    # ── Phase 2: filter to hluti='alm' (drop person/place names) ────────
    print(f"\nPhase 2: filtering {len(hits):,} hits to hluti='alm'")
    start = time.time()
    alm_words: set[str] = set()
    for i, w in enumerate(hits, start=1):
        _, entries = b.lookup(w)
        if any(e.hluti == "alm" for e in entries):
            alm_words.add(unicodedata.normalize("NFC", w))
        if i % 5_000 == 0:
            print(f"  {i:>7,} / {len(hits):,}  kept={len(alm_words):,}")

    phase2_seconds = time.time() - start
    print(f"\nPhase 2 done in {phase2_seconds:.1f}s. Final count: {len(alm_words):,}")

    # ── Output ──────────────────────────────────────────────────────────
    sorted_words = sorted(alm_words)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        for w in sorted_words:
            f.write(w + "\n")

    print(f"\nSaved {len(sorted_words):,} words to {OUTPUT_PATH}")
    print(f"Total wall time: {phase1_seconds + phase2_seconds:.1f}s")


if __name__ == "__main__":
    main()
