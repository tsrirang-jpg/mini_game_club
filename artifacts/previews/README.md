# UI previews and browser-test screenshots

Browser tests write `preview-*.png` screenshots here through
`tests/helpers/preview-path.mjs`. The directory is created automatically and its
location does not depend on the terminal working directory.

These local images help inspect responsive layouts and debug failures. They are
not application assets and are ignored by Git. Existing root-level previews were
moved here without changing their filenames. Images can be removed when no longer
needed; future browser tests recreate the screenshots they produce.

Production artwork remains in `apps/client/public/images/entry/`. Measured
performance charts remain in `reports/performance/` and are tracked separately.
