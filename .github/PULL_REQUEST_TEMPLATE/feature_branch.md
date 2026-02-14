## Feature Branch PR

> **Branch type:** `feature/*` or `claude/*`
> **Targets:** `main`

### Summary

<!-- 1-3 sentences: what does this PR do and why? -->

### Changes

<!-- Bulleted list of changes. Group by area if touching multiple systems. -->

- [ ]

### Neon Database

<!-- Check all that apply. Delete section if no DB changes. -->

| Item | Status |
|------|--------|
| Ephemeral branch created | `preview/pr-{number}` |
| Migrations included | Yes / No |
| Schema diff posted | _auto via `neon-schema-diff.yml`_ |
| Seed data needed | Yes / No |

<details>
<summary>Neon branch lifecycle for this PR</summary>

```
PR opened/synced ──► neon-vercel-preview.yml
                     ├─ neondatabase/create-branch-action@v5
                     │  branch: preview/pr-{number}
                     │  parent: primary (production)
                     ├─ Vercel build with DATABASE_URL from branch
                     └─ PR comment: preview URL + branch info

Schema changes ────► neon-schema-diff.yml
                     └─ neondatabase/schema-diff-action@v1
                        compare: preview/pr-{number} vs primary
                        posts diff as PR comment

PR closed ─────────► neon-branch-cleanup.yml
                     └─ neondatabase/delete-branch-action@v3
                        deletes: preview/pr-{number}
```

</details>

### Vercel Deployment

| Item | Details |
|------|---------|
| Preview URL | _auto-posted by workflow_ |
| Working dir | `deterministic-object-usage/viz` |
| Build passes | Yes / No / N/A |
| Env vars needed | _list any new vars_ |

<details>
<summary>Vercel deployment lifecycle for this PR</summary>

```
PR opened/synced ──► neon-vercel-preview.yml
                     ├─ vercel pull --environment=preview
                     ├─ vercel build (with Neon branch DATABASE_URL)
                     ├─ vercel deploy --prebuilt
                     └─ PR comment: preview URL

Merged to main ───► neon-vercel-production.yml
                     ├─ vercel pull --environment=production
                     ├─ vercel build --prod
                     └─ vercel deploy --prebuilt --prod
```

</details>

### How to Test

<!-- Step-by-step instructions for reviewers. -->

1. Click the Vercel preview link in the bot comment
2.

### Screenshots / Recordings

<!-- Paste screenshots or terminal recordings if UI changes. -->

### Checklist

- [ ] Self-reviewed the diff
- [ ] Neon schema diff looks correct (check bot comment)
- [ ] Vercel preview deploys and loads correctly
- [ ] No secrets or credentials committed
- [ ] CHANGELOG.md updated (if user-facing)
