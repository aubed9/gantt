# Domain Documentation

This repository uses a single-context domain model.

## Layout

- `GLOSSARY.md` at the repo root defines canonical domain terms, aliases to avoid, and definitions.
- `docs/adr/` stores Architecture Decision Records (ADRs).

## Consumer Rules

- Always consult `GLOSSARY.md` before writing code, issue descriptions, or API schemas.
- Do not introduce synonyms for terms defined in `GLOSSARY.md`.
