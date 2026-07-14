# Sales Tracker

A simple, self-contained web app for people who resell items (e.g. on Vinted, Depop,
eBay) to track what they bought, what they listed it for, and what they actually earned
when it sells — a replacement for a manual spreadsheet.

## Features

- Add items with a description, date acquired, item cost, and listing price
- Mark an item as sold (amount received + date sold), with profit calculated automatically
- List view of all items, most recent first, filterable by All / Listed / Sold
- Edit or delete any entry
- Totals dashboard: total profit, total spent, items sold, items still listed —
  broken down for **this week** and **this month** (based on the date sold)
- Proper HTML date pickers (no invalid free-typed dates)
- Numeric validation on all cost/price/amount fields

## Privacy

- **100% client-side.** All data lives in your browser's `localStorage`.
- No server, no database, no analytics, no third-party scripts, no external API calls.
- Nothing you enter ever leaves your device.

## Usage

Open `index.html` in any modern browser. That's it — no build step, no dependencies.

## Tech

Plain HTML, CSS, and JavaScript. No frameworks, no build tools.
