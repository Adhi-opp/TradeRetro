# TradeRetro Frontend — Design System

The UI is a **tokenized, class-driven design system** in `client/src/index.css`
(Tailwind 4.1 utilities + custom component classes), built on an **amber/gold
accent system** over dark-on-light surfaces. Theme switching is pure CSS via
`data-theme` on `<html>` — no re-renders, no JS palette swaps.

## Theme mechanism

```js
// App.jsx
const theme = localStorage.tr-theme ?? 'dark';   // only persisted key
document.documentElement.dataset.theme = theme;  // dark | light
```

`index.css` defines the palette **twice** under `:root[data-theme="dark"]`
(also the default via `:root`) and `:root[data-theme="light"]`:

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg-root` | near-black | off-white | page backdrop |
| `--bg-panel` | raised | white | cards/panels/tearsheet |
| `--bg-input` | darker | lighter | inputs/selects |
| `--bg-hover`, `--bg-elevated` | hover/tooltip surfaces | same roles | interaction surfaces |
| `--border`, `--border-soft`, `--border-focus` | 3 border strengths | mirrored | hairlines + focus rings |
| `--text-primary`, `--secondary`, `--muted` | text hierarchy | mirrored | typography |
| `--primary` | #F59E0B | #d97706 | **amber primary accent** (buttons, active states, focused strokes, strategy line) |
| `--primary-hover` | #FBBF24 | #b45309 | primary hover state |
| `--amber` / `--gold` | #e0a040 / #f0c040 | #d97706 / #c89600 | secondary amber highlights (badges, notable callouts) |
| `--green` / `--red` | profit/loss semantics | mirrored | financial status (also `--blue`, `--purple`, `--orange`) |

`client/src/constants/colors.js` exports
`rawColors` (raw hex values) and a semantic `colors` map that **references the
CSS variables**, so chart libraries (Recharts, lightweight-charts) pick up the
active theme without DOM queries.

> **Known divergence (verified 2026-08-16):** `colors.js` → `rawColors.dark.primary`
> is `#00c9a7` (teal) and `rawColors.light.borderFocus` `#00a888`, which do
> **not** match `index.css` (`--primary: #F59E0B` / `#d97706`). The rendered
> system is what `index.css` declares — **amber** is the true primary accent —
> and the semantic `colors` map (CSS-var based) is correct. The raw teal
> entries are a stale mirror and should be reconciled in a future cleanup.

## Typography

- System UI stack for prose; a **monospace** treatment (`.mono`) for numbers,
  tickers, timestamps, and status text (e.g. `NSE OPEN`, KPIs).
- Hierarchy by weight/size only — color carries meaning (primary text vs
  secondary vs muted), green/red for return direction.

## Components & class conventions

### Layout

- `.ide-shell` / `.app-shell-v2` — app frame: `.sidebar` (brand, nav, capstone
  card, pin, footer) + `.main-area` (.app-bar, .main-content).
- `.sidebar-tab` (with `data-tab`), `.sidebar-ai-btn`, `.sidebar-feedback-btn`,
  `.sidebar-about-btn`, `.sidebar-pin-btn`, `.sidebar-footer`.
- `.control-bar-panel` — config grid of `.cb-section` groups
  (`.cb-group-title` numbered 1–6), `.cb-grid-2`, `.cb-field`, `.cb-run-btn`,
  `.execution-status` (idle/success/error).

### Controls

| Control | Class | Behavior |
|---|---|---|
| Toggle switch | `.cost-toggle` (+ slider) | hidden native checkbox + custom slider |
| Risk toggle | `.sc-risk-toggle` / `.sc-toggle-*` | button toggles `riskEnabled`, reveals risk fields |
| Strategy select | `.strategy-select`, `.speed-select` | native selects |
| Asset picker | `.ticker-input`, `.ticker-dropdown`, `.ticker-option`, `.ticker-add-panel` | searchable universe + add flow |
| Number fields | `.sc-field`, inputs `#sc-*` | parameter entry w/ min/max |
| Buttons | `.landing-btn`, `.cb-run-btn`, `.ai-header-btn`, `.ai-settings-done-btn` | primary/ghost by context |

### Data surfaces

- `.panel` + `.panel-title-row` — shared chart/card frame (Equity, Drawdown,
  Trade Stats, etc.).
- `.kpi-ribbon` (idle market strip variant `.idle-market-ribbon`), `.kpi` tiles.
- `.tearsheet`, `.ts-row-7030` / `.ts-row-5050` container grid, `.ts-deep`
  (expanded analytics), `.ts-deep-toggle`.
- `.strategy-assessment-panel`, `.risk-grid` (risk tiles), `.trade-log`,
  `.sweep-heatmap`.

### AI Copilot

- `.ai-panel*` — panel shell; `.ai-panel-header` (`.ai-header-top`,
  `.ai-header-model-subbar` with `.ai-header-model-chip`), status pill
  (`.ai-status-ready` / `.ai-status-unavailable`).
- `.ai-empty-state`, `.ai-qa-card` (quick actions), `.ai-example-prompt`.
- `.ai-conversation` list, `.ai-message` bubbles, `.ai-prompt-input-container`
  textarea + `.ai-prompt-send-btn`, `.ai-loading-*` indicators.
- Settings: `.ai-settings-overlay` → `.ai-settings-dialog`, model picker
  (`#ai-settings-model-select` trigger, `.ai-model-dropdown`,
  `.ai-model-option` with `.is-selected`), API-key card + dialog.

### Modals

- `ui/Modal.jsx` — portal-based (`.tr-modal-overlay`, `.tr-modal`,
  `.tr-modal-header`, `.tr-modal-close`, `.tr-modal-title`), sizes md/lg/xl,
  closes on overlay click or Escape.

## Semantics & rules

1. **Never hardcode colors.** Data-viz components import token names from
   `constants/colors.js`; components only use CSS variables.
2. **Numbers right-align with mono font; direction conveyed by color
   AND sign** (never color alone).
3. **Amber** is the single interactive primary; **gold** is the highlight
   sibling for badges/notable values; green/red are strictly for P&L
   direction.
4. Every interactive element has a visible hover/active/focus-ring state
   (`--bg-hover`, `--border-focus`).
5. Empty/loading/error states are first-class visuals, not afterthoughts —
   panels always render something meaningful.

## Accessibility notes (current state)

Focus rings, aria-labels on icon buttons (Settings/Close), `role="status"`
on execution state, `role="dialog"/"listbox"`/`aria-selected` on the model
picker, keyboard Escape closes all overlays, and color contrast is checked
for both palettes during release QA.