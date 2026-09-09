# Changelog

All notable changes to this project are documented here. Format: Keep a Changelog; versioning: SemVer.

## [Unreleased]
### Added
- hpdi-engine: questionnaire v1 (32 questions, 6 pillars, 3 tiers), scoring with tier discrepancy, supp coefficients, HPDI mapping, 4 shapes, DTI level, rule-based prescription.
- forge-core: IntentV1 / PlanV1 / StateV1 schemas, pack template loader, planner (rule-generated H/D/I + pack-generated P), validator (maturity gate + 6 rules), topological order, plan/state differ.
- packs: `core` (offboarding) and `dx-ticket`.
- cli: `dxforge plan`, `dxforge packs list`, `dxforge explain`.
- web: measurement wizard (survey, radar, prescriptions, P.A.R.A kit), `/api/pulse/latest`.
- forge-core: `resultToMaturity`.
