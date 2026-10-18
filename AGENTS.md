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
git fetch origin dev-tools
git restore --source=origin/dev-tools --worktree -- tests   # files only, not staged; tests/ is in .gitignore on main
bash tests/run_all.sh                                       # setup (Playwright, fonts): tests/README.md
```

To change or add tests, commit them on `dev-tools` and push to `origin` only:

```bash
git worktree add ../finanz-dev-tools dev-tools && cp -r tests/. ../finanz-dev-tools/tests/
cd ../finanz-dev-tools && git add tests && git commit -m "…" && git push origin dev-tools
```

Before merging a feature into `main`, run `bash tests/run_all.sh`; extend the tests when you add a feature.

## Never commit personal data

`public` is world-readable, and anything pushed there stays reachable. Keep the following out of commits, issues and commit messages:

- real balances, transactions, account or bank names;
- exports of the app's data (JSON) or screenshots showing them;
- Cloudflare account IDs, KV namespace IDs and Access identifiers. They belong in Pages variables (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`) and bindings (`FINANZ_KV`), not in code.

Example data in code and docs must stay neutral (Girokonto / Sparkonto / Kreditkarte, round numbers).

## Working on the app

See [README.md](README.md) → *Development*: single `index.html`, no build step, syntax-check the inline scripts before every push, use a feature branch and check the preview before merging.

## Lessons learned (read before working)

**Working with the person**
- Change only what was asked. A layout fix for one place must be scoped to that place (e.g. the budget's detail buttons got their own class `actbtn-row`; the transaction list buttons stay as they are).
- Show every visible change on a preview branch first; merge to `main` only after an explicit "merge".
- Changes in the Cloudflare dashboard or GitHub settings need an explicit "ja" for each action.

**Environment limits (cloud session)**
- Deleting branches and changing repo settings via git/`gh` is blocked by the session's proxy. Do it through the browser, or leave it — old branches in the private repo are harmless now.
- Pushing to a repo requires the Claude GitHub App to have access to it. Adding a repo there needs GitHub's "Confirm access" (passkey/2FA), which only the person can do.
- Text typed into web forms through browser automation can lose characters. Read the field value back before saving.

**App specifics**
- Native `<input type=date>` always shows the browser's format; a page can't change it. That's why the app uses its own `DateInput` (text field + hidden native picker via `showPicker()`).
- On mobile, `button:not(.ibtn):not(.pillx):not(.chip)` sets `font-size: 14px !important` with high specificity. A plain `.actbtn` rule can't override it — style the label `span` or use a more specific selector.
- Every UI text goes through `tr()` with an `I18N_EN` entry; money through `eur()`, input through `parseAmount()`, dates through `fmtDate()`/`fmtDayMonth()`. Never hard-code `de-DE`, `€` or a date format.
- Budget templates are linked to their transactions by `budgetId` and remember `bookedMonths` / `appliedMonths`. Older transactions are only matched by identical description + amount.
- `confirm()`/`alert()` dialogs block browser automation; tests must accept or dismiss them (see `tests/helpers.py`).

**Testing**
- Measure, don't eyeball: check text overflow with `scrollWidth`/rendered width (a 1 px overflow already shows "…"), field heights and pane overflow in code, at 320–430 px and 1280–1920 px.
- Prove a test can fail: break the feature on purpose, see the test go red, restore.
- After a merge, confirm the Cloudflare Pages check is green and that both remotes point to the same `main` commit.

## Roadmap (agreed priorities, in this order)

1. **Automatic backups.** All data is one KV key that is fully overwritten on every save, and previews write to the same data. Keep the last ~30 versions (e.g. extra keys `finanz_data@<timestamp>` written by `functions/api.js` on POST, oldest pruned) and offer a restore in Settings.
2. **Budget templates in the forecast.** Unbooked templates currently don't affect the chart/forecast, so it's too optimistic if a template isn't booked. Count them as *expected* for each future month (visually distinct) until they're booked.
3. **CSV import** of bank exports (start with one common German bank format, column mapping, duplicate detection by date + amount + description).
4. **Clear terminology for "booking".** Today "Buchen" means three things: ✓ in the list (apply to balance), → in the budget (create a planned transaction), "Sofort buchen" (apply directly). Settle on *planned* vs *applied* everywhere (UI texts, explainer, README, both languages).
5. **Tests in CI.** Move the essential Playwright smoke tests into the repo (or keep them on `dev-tools`) and run them with GitHub Actions on every push.

