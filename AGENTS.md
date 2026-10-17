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

## Never commit personal data

`public` is world-readable, and anything pushed there stays reachable. Keep the following out of commits, issues and commit messages:

- real balances, transactions, account or bank names;
- exports of the app's data (JSON) or screenshots showing them;
- Cloudflare account IDs, KV namespace IDs and Access identifiers. They belong in Pages variables (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`) and bindings (`FINANZ_KV`), not in code.

Example data in code and docs must stay neutral (Girokonto / Sparkonto / Kreditkarte, round numbers).

## Working on the app

See [README.md](README.md) → *Development*: single `index.html`, no build step, syntax-check the inline scripts before every push, use a feature branch and check the preview before merging.
