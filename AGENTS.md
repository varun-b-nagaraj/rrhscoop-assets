# Repository workflow

- After completing requested changes, run the relevant checks, commit the changes, and push the current branch to its configured GitHub remote unless the user says otherwise.
- Keep secrets and local environment files out of commits.
- Use compact horizontal or vertical arrow icons. Do not use diagonal arrows.

# Decisions (ADR 0000)

- Every decision gets an ADR in `docs/adr/`, written in the same commit as the change. A decision is anything a later reader could ask "why is it like this?" about: architecture, hosting, branching and release, data handling, security settings, third-party services, or ruling out an obvious alternative. Following an existing ADR needs no new one.
- Copy the format in `docs/adr/README.md`, add the ADR to its index, and record what else was considered. To change a decision, write a new ADR and mark the old one `Superseded by NNNN`; never delete or rewrite it.
- `npm test` runs `ops/scripts/adr-index-check.sh`. If it fails because an Accepted ADR names a file you removed or renamed, update or supersede that ADR.

# Branches (ADR 0003)

- Commit and push to `main`, which is staging. Never commit or push to `production`; only the "Promote to production" GitHub Action changes it, and the owner runs it.
