# Security policy

## Supported versions

Security updates are applied on a best-effort basis for the **default branch** of this repository. Published npm/git installs should pin to a **tagged release** and upgrade deliberately.

## Reporting a vulnerability

Please report security issues **privately** (do not open a public GitHub issue for undisclosed vulnerabilities).

1. Email or contact the maintainers of **Coreline Engineering Solutions** using the contact method listed on the organization or repository profile.
2. Include: description, affected component (library vs demo vs backend), reproduction steps, and impact if known.

We will acknowledge receipt when possible and coordinate a fix and disclosure timeline.

## Scope notes

- **Consumer applications** that embed this library are responsible for their own authentication, CORS, rate limiting, and infrastructure hardening.
- The **demo app** pattern in **CONSUMER_SETUP.md** is for local development and integration testing only, not a production deployment template.

## Dependency scanning

This project uses automated dependency updates (Dependabot) and CI checks. Residual `npm audit` findings may require **major-version upgrades** of Angular or tooling; those are tracked separately from routine patch updates.
