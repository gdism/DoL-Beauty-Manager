# Development guidance

`tool/` contains the reproducible 0.1.1 source baseline. `docs/` records the product requirements and native UI direction. Root versioned default packages are existing release artifacts: do not replace, delete, or repack them as a side effect of source development.

Read `tool/DEVELOPMENT.md`, `tool/SUPPORT.md`, and the documents in `docs/` before implementation. New requirements are goals; do not claim that version-chain conversion or the new UI already exists. Preserve the default native-theme integration requirement.

Work on an appropriate Git branch, inspect existing changes, use explicit staged file lists, run checks appropriate to the change, then commit a coherent completed step. Push only within current user authorization. Do not force-push, merge, change visibility or license, or publish Releases without corresponding authorization. Do not create background syncing services.

Keep game and beauty assets, private fixtures, browser data, credentials, personal paths, raw reports, session identifiers and conversation/task logs outside tracked files. Preserve dependency licenses and public source attribution. Generated build/test output is ignored; do not bypass exclusions casually.

From `tool/`: `python -B tools/build.py`, `python -B tools/build.py --twee-entry`, then `npm test`. The checks are self-contained and need no game or image fixtures. Private runtime tests have separate prerequisites and must not be called passed solely from static checks.
