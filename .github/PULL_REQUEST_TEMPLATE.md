## Summary

<!-- What does this PR do? 1-3 sentences. -->

### Type

<!-- Check one: -->
- [ ] Feature (`feature/*`) — [use detailed template](?expand=1&template=feature_branch.md)
- [ ] Deploy package (`deploy/*`) — [use detailed template](?expand=1&template=deploy_package.md)
- [ ] Bug fix
- [ ] Refactor
- [ ] Docs / config
- [ ] CI / workflow

### Changes

-

### Neon + Vercel

<!-- Delete if not applicable. Otherwise, the workflows handle this automatically: -->

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `neon-vercel-preview.yml` | PR open/sync | Creates `preview/pr-{N}` Neon branch + Vercel preview |
| `neon-schema-diff.yml` | PR open/sync (schema paths) | Posts schema diff as comment |
| `neon-branch-cleanup.yml` | PR close | Deletes ephemeral Neon branch |
| `neon-vercel-production.yml` | Push to main (`viz/**`) | Production Vercel deploy |

### Test Plan

- [ ]

### Checklist

- [ ] Self-reviewed
- [ ] No secrets committed
- [ ] CI passes
