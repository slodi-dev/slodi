# NOTICE — third-party data

## `icelandic_5_letter_words.txt`

The 24,930-word valid-guess dictionary in this directory is **derived from
BÍN — Beygingarlýsing íslensks nútímamáls** (the Database of Modern Icelandic
Inflection), maintained by **Stofnun Árna Magnússonar í íslenskum fræðum**
(The Árni Magnússon Institute for Icelandic Studies).

- Source database: <https://bin.arnastofnun.is/>
- Accessed via: the [`islenska`](https://pypi.org/project/islenska/) Python
  package, which packages a snapshot of BÍN with a fast DAWG-backed lookup API.
- License: **Creative Commons Attribution-ShareAlike 4.0 International
  (CC BY-SA 4.0).** See <https://creativecommons.org/licenses/by-sa/4.0/>.

### How the file was generated

`backend/scripts/generate_heidursordla_dictionary.py` brute-forces the 32-letter
Icelandic alphabet (32^5 ≈ 33.5M five-letter candidates) through `Bin.contains()`,
then filters the survivors to entries with `hluti='alm'` (general vocabulary —
excludes person names `ism` and place names `örn`), NFC-normalizes, and writes
the sorted list one word per line.

The runtime backend has **no** dependency on `islenska` — it loads this static
text file at startup into a `frozenset[str]`. The package is only needed when
regenerating the file, and lives in the dev dependency group of
`backend/pyproject.toml`.

### Attribution & share-alike obligations

When this file (or any derivative of it) is redistributed, the recipient must:

1. Be informed of BÍN as the source and of the CC BY-SA 4.0 license.
2. Receive any modifications to the data under the same CC BY-SA 4.0 license
   (the share-alike clause).

This NOTICE.md file fulfills the attribution requirement for the Slóði repo's
distribution of the dictionary. The Slóði application code itself is licensed
separately (see the repository root `LICENSE` if present); CC BY-SA 4.0 applies
to the dictionary data only, not to the surrounding code.
