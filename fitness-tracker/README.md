# 90-Day Fitness Tracker

A small installable web app for logging a 90-day fitness challenge, based on the
`90Day_Fitness_Tracker.xlsx` plan (daily log + weekly summary with target weights).

## Features

- **Today tab** — quick daily entry: weight, calories, protein, water, steps, gym,
  cardio, sleep, cigarettes, outside food, mood and notes. Navigate to any day
  (1–90) to fill in or edit past/future entries.
- **History tab** — full 90-day table, export to CSV or JSON.
- **Weekly tab** — auto-calculated actual weight/gym sessions/avg steps per week,
  compared against the pre-loaded target weights from the plan, plus a simple chart.
- **Settings tab** — set your Day 1 date, a daily reminder time, enable browser
  notifications, back up/restore your data as JSON, or reset everything.
- Installable as a home-screen app (PWA) with offline support.

## Data storage

This is a static site with no backend or database — all data is saved in your
browser's `localStorage`, on your device only. Nothing is uploaded anywhere.
Use **Settings → Export JSON backup** regularly, especially before clearing
browser data or switching devices. Reminders only fire while the app/tab is
open (or installed and running in the background on supported devices); a
fully closed browser with no server can't receive a true push notification.

## Running locally

No build step needed — it's plain HTML/CSS/JS. Serve the folder with any
static file server, e.g.:

```bash
cd fitness-tracker
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Hosting on GitHub Pages

A workflow at `.github/workflows/deploy-fitness-tracker.yml` publishes this
folder to GitHub Pages automatically on every push to `main` that touches
`fitness-tracker/`. To turn it on:

1. Merge this branch into `main`.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. After the workflow runs, your tracker will be live at
   `https://<your-username>.github.io/<repo-name>/`.
