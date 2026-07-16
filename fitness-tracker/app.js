(() => {
  "use strict";

  const STORAGE_KEY = "fitnessTracker90.v1";
  const TOTAL_DAYS = 90;
  const TARGET_WEIGHTS = [89, 87.5, 86, 84.5, 83.5, 82.8, 82, 81.5, 81, 80.5, 80, 79.5, 79];
  const FIELD_IDS = ["weight", "calories", "protein", "water", "steps", "gym", "cardio", "sleep", "cigarettes", "outsideFood", "mood", "notes"];

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function defaultState() {
    return {
      startDate: todayISO(),
      entries: {},
      weeklyNotes: {},
      reminderTime: "20:00",
      reminderEnabled: false,
      lastNotifiedDate: null,
      bannerDismissedDate: null,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      console.warn("Failed to load saved data, starting fresh.", e);
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState();
  let currentDay = clampDay(dayForDateISO(todayISO()));
  let formSelections = { gym: null, outsideFood: null, mood: null };

  function dateForDay(day) {
    const start = new Date(state.startDate + "T00:00:00");
    start.setDate(start.getDate() + (day - 1));
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  }

  function dayForDateISO(iso) {
    const start = new Date(state.startDate + "T00:00:00");
    const target = new Date(iso + "T00:00:00");
    const diff = Math.round((target - start) / 86400000) + 1;
    return diff;
  }

  function clampDay(day) {
    return Math.min(TOTAL_DAYS, Math.max(1, day));
  }

  function formatDateNice(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  }

  function weekForDay(day) {
    return Math.ceil(day / 7);
  }

  // ---------- Tabs ----------
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "history") renderHistory();
      if (btn.dataset.tab === "weekly") renderWeekly();
      if (btn.dataset.tab === "settings") renderSettings();
    });
  });

  function switchToTab(name) {
    document.querySelector(`.tab[data-tab="${name}"]`).click();
  }

  // ---------- Today form ----------
  function loadEntryIntoForm(day) {
    const entry = state.entries[day] || {};
    document.getElementById("todayDayNum").textContent = day;
    document.getElementById("todayDate").textContent = formatDateNice(dateForDay(day));
    document.getElementById("dayLabel").textContent = `Day ${day} of ${TOTAL_DAYS}`;

    ["weight", "calories", "protein", "water", "steps", "cardio", "sleep", "cigarettes"].forEach((key) => {
      document.getElementById(`f-${key}`).value = entry[key] ?? "";
    });
    document.getElementById("f-notes").value = entry.notes ?? "";

    formSelections = { gym: entry.gym ?? null, outsideFood: entry.outsideFood ?? null, mood: entry.mood ?? null };
    syncSegmented();
    document.getElementById("saveStatus").textContent = "";
  }

  function syncSegmented() {
    document.querySelectorAll(".segmented").forEach((group) => {
      const field = group.dataset.field;
      group.querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.toggle("selected", formSelections[field] === b.dataset.value);
      });
    });
    document.querySelectorAll(".mood-btn").forEach((b) => {
      b.classList.toggle("selected", String(formSelections.mood) === b.dataset.value);
    });
  }

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.closest(".segmented").dataset.field;
      formSelections[field] = formSelections[field] === btn.dataset.value ? null : btn.dataset.value;
      syncSegmented();
    });
  });

  document.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      formSelections.mood = formSelections.mood === btn.dataset.value ? null : btn.dataset.value;
      syncSegmented();
    });
  });

  function readFormEntry() {
    const entry = {};
    ["weight", "calories", "protein", "water", "steps", "cardio", "sleep", "cigarettes"].forEach((key) => {
      const val = document.getElementById(`f-${key}`).value;
      if (val !== "") entry[key] = Number(val);
    });
    entry.notes = document.getElementById("f-notes").value.trim();
    if (formSelections.gym) entry.gym = formSelections.gym;
    if (formSelections.outsideFood) entry.outsideFood = formSelections.outsideFood;
    if (formSelections.mood) entry.mood = Number(formSelections.mood);
    return entry;
  }

  function isEntryEmpty(entry) {
    if (!entry) return true;
    return FIELD_IDS.every((k) => entry[k] === undefined || entry[k] === "" || entry[k] === null);
  }

  document.getElementById("saveEntry").addEventListener("click", () => {
    const entry = readFormEntry();
    if (isEntryEmpty(entry)) {
      delete state.entries[currentDay];
    } else {
      entry.date = dateForDay(currentDay);
      state.entries[currentDay] = entry;
    }
    saveState();
    document.getElementById("saveStatus").textContent = `Saved ✓ (${formatDateNice(dateForDay(currentDay))})`;
    updateStats();
    maybeHideBanner();
  });

  document.getElementById("prevDay").addEventListener("click", () => {
    currentDay = clampDay(currentDay - 1);
    loadEntryIntoForm(currentDay);
  });
  document.getElementById("nextDay").addEventListener("click", () => {
    currentDay = clampDay(currentDay + 1);
    loadEntryIntoForm(currentDay);
  });

  // ---------- Stats ----------
  function updateStats() {
    const loggedDays = Object.keys(state.entries)
      .map(Number)
      .filter((d) => !isEntryEmpty(state.entries[d]))
      .sort((a, b) => a - b);

    document.getElementById("statLogged").textContent = `${loggedDays.length} / ${TOTAL_DAYS}`;

    let streak = 0;
    const planToday = clampDay(dayForDateISO(todayISO()));
    for (let d = planToday; d >= 1; d--) {
      if (state.entries[d] && !isEntryEmpty(state.entries[d])) streak++;
      else break;
    }
    document.getElementById("statStreak").textContent = streak;

    const steps = loggedDays.map((d) => state.entries[d].steps).filter((v) => typeof v === "number");
    document.getElementById("statAvgSteps").textContent = steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length).toLocaleString() : "—";

    const weights = loggedDays.map((d) => state.entries[d].weight).filter((v) => typeof v === "number");
    if (weights.length >= 2) {
      const diff = weights[weights.length - 1] - weights[0];
      const sign = diff > 0 ? "+" : "";
      document.getElementById("statWeightChange").textContent = `${sign}${diff.toFixed(1)} kg`;
    } else {
      document.getElementById("statWeightChange").textContent = "—";
    }
  }

  // ---------- History ----------
  function renderHistory() {
    const body = document.getElementById("historyBody");
    body.innerHTML = "";
    const planToday = clampDay(dayForDateISO(todayISO()));
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const entry = state.entries[day] || {};
      const tr = document.createElement("tr");
      tr.className = "editable-row" + (day === planToday ? " today-row" : "");
      tr.innerHTML = `
        <td>${day}</td>
        <td>${formatDateShort(dateForDay(day))}</td>
        <td>${entry.weight ?? ""}</td>
        <td>${entry.calories ?? ""}</td>
        <td>${entry.protein ?? ""}</td>
        <td>${entry.water ?? ""}</td>
        <td>${entry.steps ?? ""}</td>
        <td>${entry.gym ?? ""}</td>
        <td>${entry.cardio ?? ""}</td>
        <td>${entry.sleep ?? ""}</td>
        <td>${entry.cigarettes ?? ""}</td>
        <td>${entry.outsideFood ?? ""}</td>
        <td>${entry.mood ?? ""}</td>
        <td>${(entry.notes ?? "").replace(/</g, "&lt;")}</td>
      `;
      tr.addEventListener("click", () => {
        currentDay = day;
        loadEntryIntoForm(currentDay);
        switchToTab("today");
      });
      body.appendChild(tr);
    }
  }

  function formatDateShort(iso) {
    const d = new Date(iso + "T00:00:00");
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  // ---------- Weekly ----------
  function computeWeekStats(week) {
    const from = (week - 1) * 7 + 1;
    const to = Math.min(week * 7, TOTAL_DAYS);
    let weights = [];
    let steps = [];
    let gymCount = 0;
    for (let d = from; d <= to; d++) {
      const e = state.entries[d];
      if (!e) continue;
      if (typeof e.weight === "number") weights.push(e.weight);
      if (typeof e.steps === "number") steps.push(e.steps);
      if (e.gym === "Y") gymCount++;
    }
    return {
      from,
      to,
      actualWeight: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
      avgSteps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null,
      gymCount,
    };
  }

  function renderWeekly() {
    const body = document.getElementById("weeklyBody");
    body.innerHTML = "";
    const totalWeeks = Math.ceil(TOTAL_DAYS / 7);

    for (let week = 1; week <= totalWeeks; week++) {
      const stats = computeWeekStats(week);
      const target = TARGET_WEIGHTS[week - 1] ?? "";
      const notes = state.weeklyNotes[week] || {};

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${week}</td>
        <td>${target}</td>
        <td>${stats.actualWeight ? stats.actualWeight.toFixed(1) : "—"}</td>
        <td><input type="number" step="0.1" class="waist-input" data-week="${week}" value="${notes.waist ?? ""}" style="width:80px" /></td>
        <td>${stats.gymCount}</td>
        <td>${stats.avgSteps ? stats.avgSteps.toLocaleString() : "—"}</td>
        <td><input type="text" class="comment-input" data-week="${week}" value="${(notes.comments ?? "").replace(/"/g, "&quot;")}" style="width:160px" /></td>
      `;
      body.appendChild(tr);
    }

    body.querySelectorAll(".waist-input").forEach((input) => {
      input.addEventListener("change", () => {
        const week = input.dataset.week;
        state.weeklyNotes[week] = state.weeklyNotes[week] || {};
        state.weeklyNotes[week].waist = input.value ? Number(input.value) : undefined;
        saveState();
      });
    });
    body.querySelectorAll(".comment-input").forEach((input) => {
      input.addEventListener("change", () => {
        const week = input.dataset.week;
        state.weeklyNotes[week] = state.weeklyNotes[week] || {};
        state.weeklyNotes[week].comments = input.value;
        saveState();
      });
    });

    drawWeightChart(totalWeeks);
  }

  function drawWeightChart(totalWeeks) {
    const svg = document.getElementById("weightChart");
    const width = 600, height = 240, padX = 30, padY = 20;
    const targets = [];
    const actuals = [];
    for (let week = 1; week <= totalWeeks; week++) {
      targets.push(TARGET_WEIGHTS[week - 1] ?? null);
      const s = computeWeekStats(week);
      actuals.push(s.actualWeight);
    }
    const all = [...targets, ...actuals].filter((v) => v !== null && v !== undefined);
    if (!all.length) {
      svg.innerHTML = `<text x="300" y="120" text-anchor="middle" fill="#93a0b7" font-size="14">Log some weights to see your chart</text>`;
      return;
    }
    const min = Math.min(...all) - 1;
    const max = Math.max(...all) + 1;

    function x(i) {
      return padX + (i * (width - 2 * padX)) / (totalWeeks - 1 || 1);
    }
    function y(v) {
      return height - padY - ((v - min) / (max - min || 1)) * (height - 2 * padY);
    }

    function toPoints(series) {
      return series
        .map((v, i) => (v === null || v === undefined ? null : `${x(i)},${y(v)}`))
        .filter(Boolean)
        .join(" ");
    }

    const targetPts = toPoints(targets);
    const actualPts = toPoints(actuals);

    let dots = "";
    actuals.forEach((v, i) => {
      if (v !== null && v !== undefined) {
        dots += `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#22c55e" />`;
      }
    });
    targets.forEach((v, i) => {
      if (v !== null && v !== undefined) {
        dots += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#3b82f6" />`;
      }
    });

    svg.innerHTML = `
      <polyline points="${targetPts}" fill="none" stroke="#3b82f6" stroke-width="2" />
      <polyline points="${actualPts}" fill="none" stroke="#22c55e" stroke-width="2" />
      ${dots}
    `;
  }

  // ---------- Export / Import ----------
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCsv() {
    const header = ["Day", "Date", "Weight (kg)", "Calories", "Protein (g)", "Water (L)", "Steps", "Gym (Y/N)", "Cardio (min)", "Sleep (hrs)", "Cigarettes", "Outside Food?", "Mood (1-5)", "Notes"];
    const rows = [header.join(",")];
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const e = state.entries[day] || {};
      const row = [
        day,
        dateForDay(day),
        e.weight ?? "",
        e.calories ?? "",
        e.protein ?? "",
        e.water ?? "",
        e.steps ?? "",
        e.gym ?? "",
        e.cardio ?? "",
        e.sleep ?? "",
        e.cigarettes ?? "",
        e.outsideFood ?? "",
        e.mood ?? "",
        `"${(e.notes ?? "").replace(/"/g, '""')}"`,
      ];
      rows.push(row.join(","));
    }
    return rows.join("\n");
  }

  document.getElementById("exportCsv").addEventListener("click", () => {
    download("90-day-fitness-tracker.csv", toCsv(), "text/csv");
  });
  function exportJson() {
    download("90-day-fitness-tracker-backup.json", JSON.stringify(state, null, 2), "application/json");
  }
  document.getElementById("exportJson").addEventListener("click", exportJson);
  document.getElementById("exportJson2").addEventListener("click", exportJson);

  document.getElementById("importJsonInput").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!confirm("Import this backup? This will overwrite your current data.")) return;
        state = Object.assign(defaultState(), parsed);
        saveState();
        currentDay = clampDay(dayForDateISO(todayISO()));
        loadEntryIntoForm(currentDay);
        renderSettings();
        updateStats();
        alert("Backup imported.");
      } catch (e) {
        alert("That file doesn't look like a valid backup.");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  });

  document.getElementById("resetData").addEventListener("click", () => {
    if (!confirm("This will permanently delete all logged days in this browser. Continue?")) return;
    state = defaultState();
    saveState();
    currentDay = clampDay(dayForDateISO(todayISO()));
    loadEntryIntoForm(currentDay);
    renderSettings();
    updateStats();
  });

  // ---------- Settings ----------
  function renderSettings() {
    document.getElementById("startDate").value = state.startDate;
    document.getElementById("reminderTime").value = state.reminderTime;
    updateNotifStatusText();
  }

  document.getElementById("startDate").addEventListener("change", (ev) => {
    state.startDate = ev.target.value;
    saveState();
    currentDay = clampDay(dayForDateISO(todayISO()));
    loadEntryIntoForm(currentDay);
  });

  document.getElementById("reminderTime").addEventListener("change", (ev) => {
    state.reminderTime = ev.target.value;
    saveState();
  });

  function updateNotifStatusText() {
    const el = document.getElementById("notifStatus");
    if (!("Notification" in window)) {
      el.textContent = "Notifications are not supported in this browser.";
      return;
    }
    if (Notification.permission === "granted") {
      el.textContent = "Notifications enabled ✓";
      state.reminderEnabled = true;
    } else if (Notification.permission === "denied") {
      el.textContent = "Notifications blocked in browser settings.";
      state.reminderEnabled = false;
    } else {
      el.textContent = "Notifications not yet enabled.";
    }
  }

  document.getElementById("enableNotif").addEventListener("click", async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    await Notification.requestPermission();
    updateNotifStatusText();
    saveState();
  });

  // ---------- Reminder loop & banner ----------
  function checkReminder() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = todayISO();
    if (hhmm !== state.reminderTime || state.lastNotifiedDate === today) return;

    const planDay = clampDay(dayForDateISO(today));
    const filled = state.entries[planDay] && !isEntryEmpty(state.entries[planDay]);
    if (filled) return;

    new Notification("90-Day Fitness Tracker", {
      body: `Time to log Day ${planDay}! Don't break your streak.`,
      icon: "icons/icon-192.png",
    });
    state.lastNotifiedDate = today;
    saveState();
  }
  setInterval(checkReminder, 20000);

  function maybeShowBanner() {
    const today = todayISO();
    if (state.bannerDismissedDate === today) return;
    const planDay = clampDay(dayForDateISO(today));
    if (planDay < 1 || planDay > TOTAL_DAYS) return;
    const filled = state.entries[planDay] && !isEntryEmpty(state.entries[planDay]);
    if (filled) return;
    document.getElementById("reminderBannerText").textContent = `You haven't logged Day ${planDay} yet today.`;
    document.getElementById("reminderBanner").classList.remove("hidden");
  }

  function maybeHideBanner() {
    document.getElementById("reminderBanner").classList.add("hidden");
  }

  document.getElementById("dismissBanner").addEventListener("click", () => {
    state.bannerDismissedDate = todayISO();
    saveState();
    maybeHideBanner();
  });

  // ---------- PWA install ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById("installBtn").classList.remove("hidden");
  });
  document.getElementById("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById("installBtn").classList.add("hidden");
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
    });
  }

  // ---------- Init ----------
  loadEntryIntoForm(currentDay);
  updateStats();
  maybeShowBanner();
})();
