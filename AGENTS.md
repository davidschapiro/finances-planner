# Notes for coding agents

## Two repositories — always push to both

This code lives in two GitHub repositories with the **same history**:

| Remote | Repository | Visibility | Role |
|---|---|---|---|
| `origin` | `davidschapiro/finanzuebersicht` | private | Connected to Cloudflare Pages — pushes to `main` deploy the live app; other branches get preview deployments |
| `public` | `davidschapiro/finances-planner` | public | Open-source copy for others to fork |

**Rule: always push to both remotes, unless the person explicitly says otherwise for that change.**

```bash
git remote add public https://github.com/davidschapiro/finances-planner   # once per clone
git push origin main && git push public main
```

- Feature branches: push them to `origin` for a preview deployment. Pushing them to `public` is optional; once merged, push `main` to both.
- Never rewrite or force-push `main` on either remote — the histories must stay identical.

## Tests (private branch `dev-tools`)

Browser tests (Playwright) and the API unit test live on the branch **`dev-tools` in `origin` only** — never push that branch to `public`. To use them:

```bash
git fetch origin dev-tools && git checkout origin/dev-tools -- tests   # bring tests/ into your working copy (don't commit it to main)
bash tests/run_all.sh                                                   # see tests/README.md for setup
```

New tests go to `dev-tools` (commit there, push to `origin` only).

## Never commit personal data

`public` is world-readable, and anything pushed there stays reachable. Keep the following out of commits, issues and commit messages:

- real balances, transactions, account or bank names;
- exports of the app's data (JSON) or screenshots showing them;
- Cloudflare account IDs, KV namespace IDs and Access identifiers. They belong in Pages variables (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`) and bindings (`FINANZ_KV`), not in code.

Example data in code and docs must stay neutral (Girokonto / Sparkonto / Kreditkarte, round numbers).

## Working on the app

See [README.md](README.md) → *Development*: single `index.html`, no build step, syntax-check the inline scripts before every push, use a feature branch and check the preview before merging.

## Roadmap (agreed priorities, in this order)

1. **Automatic backups.** All data is one KV key that is fully overwritten on every save, and previews write to the same data. Keep the last ~30 versions (e.g. extra keys `finanz_data@<timestamp>` written by `functions/api.js` on POST, oldest pruned) and offer a restore in Settings.
2. **Budget templates in the forecast.** Unbooked templates currently don't affect the chart/forecast, so it's too optimistic if a template isn't booked. Count them as *expected* for each future month (visually distinct) until they're booked.
3. **CSV import** of bank exports (start with one common German bank format, column mapping, duplicate detection by date + amount + description).
4. **Clear terminology for "booking".** Today "Buchen" means three things: ✓ in the list (apply to balance), → in the budget (create a planned transaction), "Sofort buchen" (apply directly). Settle on *planned* vs *applied* everywhere (UI texts, explainer, README, both languages).
5. **Tests in CI.** Move the essential Playwright smoke tests into the repo (or keep them on `dev-tools`) and run them with GitHub Actions on every push.

