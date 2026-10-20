# Finanzübersicht

Personal finance dashboard: account balances, planned transactions, a balance forecast chart and a monthly budget. Single-page web app in **German and English**, designed for phone and desktop (Material 3 look, light and dark mode).

Runs on your own free Cloudflare account, behind your own login — see [Set up your own copy](#set-up-your-own-copy). MIT licensed.

## Features

**Overview**
- **Gesamtsaldo tile**: total of all accounts, projected total (Prognose) and total buffer above the overdraft limits. The ⚙ in the tile chooses which accounts are included. On desktop at most 3 account cards share a row; with 4–5 accounts the tile shrinks to a card (same layout as on the phone, all figures kept) and shares the first row with 1–2 accounts.
- **Account cards**: current balance, a bar and the projected end balance. The ⚙ on a card edits balance, account type, limit or goal and colour in place.
- **Account types (Kontoart)**:
  - *Girokonto* — bar shows the buffer above the overdraft limit (Dispo-Limit);
  - *Sparkonto* — bar shows progress towards a savings goal (Sparziel);
  - *Kreditkarte* — bar shows the buffer within the credit limit (Kreditrahmen); incoming amounts are treated as repayments/refunds and don't count as budget income.
- **Chart**: balance per account over time, dashed limit lines and markers where an account drops below its limit.

**Transactions**
- **Neue Buchung** (floating button on mobile): date, account, description, tags, amount. The amount field has a built-in calculator (full expression with operator precedence, `%`, German number format).
- **Umbuchung** (transfer): moves money between two accounts as a *single* entry (`Von → Nach`). It is neutral in the budget and in search sums.
- **Sofort buchen**: applies an amount (or a transfer) straight to the balance without a list entry, with **Rückgängig** (undo).
- **Buchen**: the ✓ at the end of every list row applies a planned transaction to the balance and removes it from the list (with confirmation). Tapping the row reveals Kopieren / Bearbeiten / Löschen.
- **Copy, edit and delete**: tap or click a transaction to show its actions.
- **Layout**: on wide screens (≥ 1280 px) two panes in a 2:1 ratio, with the overview (totals, accounts, budget, chart) on the left and the transactions on the right; the left pane stays in view while the list scrolls.
- **Search**: matches text, account, tag, amount (`45`, `1.234,50`, `-45,00`) and date (`2026-06`, `09.06.`, `juni`). All terms must match; the match count and the sum are shown.
- **Tag filter** with colour chips. Colours are adjusted automatically for contrast in light and dark mode.

**Budget**
- Per month: income and expense templates plus the month's actual entries. The header shows **Übrig** (left over) = income − expenses − saved.
- **Transfers** in the budget depend on the account setting **"Im Budget"** (⚙ on the account; savings accounts are outside by default):
  - into an account outside the budget → **Gespart** (saved); back out of it → **Entnommen** (withdrawn), shown in the same section;
  - between two budget accounts (e.g. checking → credit card) → **Umbuchungen**, neutral, not counted in Übrig;
  - income and expenses on accounts outside the budget don't count.
- Templates (also transfer templates with From → To) can be booked for a month (round → button, with a date), undone (↺), edited and deleted (tap the row; delete has undo). States: *offen*, *✓ gebucht* (planned transaction in the list), *✓ angewendet* (applied to the balance with ✓).
- An ⓘ next to the title explains all of this in the app (German / English).

**Settings** (⚙ next to the title)
- **Language** (Deutsch / English) and **currency** (EUR, USD, GBP, CHF, ILS, …). Both are saved with the data, so every device shows the same. Without a saved choice the language follows the browser. Number input follows the language: `1.234,50` in German, `1,234.50` in English.
- **Date format**: automatic (follows the language) or fixed: `31.12.2026`, `31/12/2026`, `12/31/2026`, `2026-12-31`. It applies to the list, the chart and all date fields; the app uses its own date field (type the date, or open the system calendar with the 📅 button), because native date fields always follow the browser's language.
- Export and import all data as JSON.

## Architecture

| Part | Where |
|---|---|
| Frontend | `index.html`: a single file (React 18 and Chart.js inlined, no build step) |
| Hosting | Cloudflare Pages, auto-deploys on push to `main`; every branch gets a preview at `https://<branch>.<project>.pages.dev` |
| API | Pages Function `functions/api.js`, served at **`/api` on the same address as the app** (`GET` returns the data, `POST` replaces it) |
| Storage | Cloudflare KV namespace `finanz-kv`, bound to the Pages project as `FINANZ_KV`, key `finanz_data` |
| Login | Cloudflare Zero Trust **Access** application covering `<project>.pages.dev` and `*.<project>.pages.dev` |
| Fonts and icons | Source Sans 3, Material Symbols Outlined (subset via `icon_names`), both from Google Fonts |

> **Note:** preview deployments use the **same KV** as production (if the binding is set for Preview too). Anything saved in a preview changes the real data.

### Data model (`finanz_data`)

```jsonc
{
  "txs": [                       // planned transactions
    { "id": 1729..., "date": "2026-10-20", "acct": "giro", "desc": "Miete", "amt": -850, "tags": [2] },
    { "id": 1729..., "date": "2026-10-31", "acct": "giro", "to": "spar",     // transfer: amt leaves `acct`
      "desc": "Sparrate", "amt": -150, "tags": [] }                          // and arrives at `to`
  ],
  "init":   { "giro": 500, "spar": 1000 },                                  // current balances
  "accts":  {
    "giro":  { "label": "Girokonto", "color": "#EF9F27", "floor": -1000, "inTotal": true },
    "spar":  { "label": "Sparkonto", "color": "#1D9E75", "floor": 0, "type": "savings", "goal": 5000 },
    "karte": { "label": "Kreditkarte", "color": "#378ADD", "floor": -1500, "type": "credit" }
  },                                                                         // type: omitted = Girokonto
  "tags":   [ { "id": 2, "label": "Fixkosten", "color": "#e11d48" } ],
  "budget": [ { "id": 1729..., "desc": "Netflix", "amt": -12.99, "acct": "giro" } ],  // monthly templates
  "settings": { "lang": "en", "currency": "EUR", "dateFormat": "auto" },  // optional
  "rev": "m1x2y3abc"                                                       // revision of the last save
}
```

### Sync and conflict protection

- **When data is loaded:** on start, every 5 minutes, and whenever the app comes back to the foreground.
- **Every save carries a revision (`rev`).** Before writing, the app re-reads the server copy. If another device or tab saved in the meantime, it does a 3-way merge instead of overwriting:
  - transactions, tags and budget items are merged by `id`, so additions, edits and deletions from both sides are kept;
  - accounts are merged by key;
  - balances are merged by delta, so changes from both sides add up.
- **When a merge happens,** the app shows a snackbar.
- **Conflict rule:** if the same entry is edited on two devices at the same time, the last save wins.
- **Offline fallback:** `localStorage` (`finanz_v1`) is used when `/api` can't be reached, and when the file is opened locally.
- **Expired login:** if the Access session has expired, the app shows *"Anmeldung abgelaufen – Neu laden"* instead of silently failing.

## Set up your own copy

You need a free [Cloudflare](https://dash.cloudflare.com) account and a GitHub account. There is no build step and no separate server; Cloudflare Pages serves the app *and* the API.

1. **Copy the repo.** Fork it, or use it as the basis of a new (optionally private) repo.

2. **Create the KV namespace** (where the data lives). *Workers & Pages → KV → Create namespace* and name it e.g. `finanz-kv`.

3. **Create the Pages project.**
   1. *Workers & Pages → Create → Pages → Connect to Git* and select your repo.
   2. Framework preset: **None**. Build command: *(empty)*. Build output directory: **`/`**.
   3. Deploy. Cloudflare picks up `functions/api.js` automatically and serves it at `/api`.

4. **Bind the KV namespace.** In the Pages project: *Settings → Bindings → Add → KV namespace*.
   - Variable name: **`FINANZ_KV`**. Namespace: `finanz-kv`.
   - Set it for **Production and Preview**.
   - Redeploy (*Deployments → … → Retry deployment*).

5. **Protect it with Cloudflare Access** (free for up to 50 users).
   1. *Zero Trust → Access → Applications → Add an application → Self-hosted*.
   2. Add **two public hostnames**: `<project>.pages.dev` and `*.<project>.pages.dev` (the second one covers preview deployments).
   3. Policy: *Allow* and *Include → Emails →* your address. Login method: one-time PIN or Google.
   4. Copy the application's **AUD tag** (in the application's overview) and your **team domain** (`<team>.cloudflareaccess.com`).

6. **Tell the API about your Access application.** In the Pages project, under *Settings → Variables and Secrets* (Production and Preview), set:
   - `ACCESS_TEAM_DOMAIN` = `<team>.cloudflareaccess.com`
   - `ACCESS_AUD` = the AUD tag

   Then redeploy. Without these, the API refuses every request (`500 not configured`) — it never falls back to an open state.

   **No Access?** Set `ACCESS_DISABLED = true` instead. The data is then readable and writable by anyone who knows the address, which is **not recommended**.

7. **Make it yours.** Open `https://<project>.pages.dev`, log in, and:
   - set balances, account type, limits or savings goal and colours with ⚙ on each account card;
   - add accounts with **+ Konto** and create tags with **Tags**;
   - delete the example transactions.

   The example accounts (Girokonto, Sparkonto, Kreditkarte) can be renamed or deleted freely; nothing in the code depends on account keys.

**Alternative without Cloudflare:** opened as a local file, the app falls back to `localStorage` and still works on that one device. Backups go through *Einstellungen → Export/Import*.

## Security

- **One login protects both the app and the data.** The app and the API live on the **same address**, so the Cloudflare Access login covers both. The browser sends the Access cookie with every data request automatically.
- **The API checks the login itself (defense in depth).** On every request, `functions/api.js` verifies the **Access token**: the signature against your team's public keys, the audience (your Access application) and the expiry. If Access were ever misconfigured or switched off, the data would stay locked (`401`) instead of becoming public.
- **Preview deployments** are covered by the `*.<project>.pages.dev` hostname in the Access application.
- **No credentials live in the repo.** The AUD tag and the team domain are identifiers, not secrets.

## Development

- **Editing:** edit `index.html` directly; there is no build step.
- **Before every push:** syntax-check all inline scripts. Several blank-page incidents were caused by JS errors.
  ```bash
  python3 -c "import re;[open(f'/tmp/s{i}.js','w').write(b) for i,b in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',open('index.html').read(),re.S))]"
  for f in /tmp/s*.js; do node --check "$f" || exit 1; done
  ```
- **Larger changes:** use a feature branch, check the preview URL, then merge to `main`.
- **Texts and languages:** UI texts are written in German in the code and wrapped in `tr('…')`; the English text lives in the `I18N_EN` dictionary (placeholders like `{n}` are filled from the second argument). Every new text needs an `I18N_EN` entry. To add a language, add it to `LANGS` and add a dictionary next to `I18N_EN` (and pick it in `tr`). Money goes through `eur()`, user input through `parseAmount()`, dates through `fmtDate()` / `fmtDayMonth()` and the `DateInput` field — never hard-code `de-DE` or `€`.

**Gotchas**
- The API must stay on the **same origin** as the app (Pages Function at `/api`). A separate `workers.dev` Worker can't be put behind Access: the Access cookie isn't sent there, and Access blocks the CORS preflight.
- When adding an Access hostname, add `*.<project>.pages.dev` *in addition to* the bare `<project>.pages.dev`, because the wildcard doesn't cover the bare domain.
- Dropdowns and popovers close on `mousedown` outside, so their own handlers use `mousedown` and `stopPropagation`.
- Material Symbols are loaded as a subset. When adding an icon, add its name to `icon_names=` in the `<link>` (alphabetical order).

## License

[MIT](LICENSE)
