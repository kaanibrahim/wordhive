/* ==========================================================================
   Word Hive
   WORD_LIST is provided by words.js (loaded before this file).
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Seeded RNG (mulberry32) so today's puzzle is identical for everyone
     ------------------------------------------------------------------ */
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ------------------------------------------------------------------
     Date helpers — puzzle rolls over at Europe/London midnight
     ------------------------------------------------------------------ */
  const HIVE_TIME_ZONE = "Europe/London";
  const hivePartsFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: HIVE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  function todayHiveString(now = new Date()) {
    const parts = hivePartsFormatter.formatToParts(now);
    const year = parts.find((part) => part.type === "year").value;
    const month = parts.find((part) => part.type === "month").value;
    const day = parts.find((part) => part.type === "day").value;
    return `${year}-${month}-${day}`;
  }

  function msUntilNextHiveMidnight(now = new Date()) {
    const nextDate = new Date(`${todayHiveString(now)}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    // Find the exact UTC instant whose London clock reads 00:00. This
    // handles both GMT and BST without relying on the user's timezone.
    let candidate = nextDate.getTime();
    for (let i = 0; i < 4; i++) {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: HIVE_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).formatToParts(new Date(candidate));
      const year = Number(parts.find((part) => part.type === "year").value);
      const month = Number(parts.find((part) => part.type === "month").value);
      const day = Number(parts.find((part) => part.type === "day").value);
      const hour = Number(parts.find((part) => part.type === "hour").value);
      const minute = Number(parts.find((part) => part.type === "minute").value);
      const second = Number(parts.find((part) => part.type === "second").value);
      const displayedAsUTC = Date.UTC(year, month - 1, day, hour, minute, second);
      candidate -= displayedAsUTC - nextDate.getTime();
    }
    return candidate - now.getTime();
  }

  function formatDateHuman(dateStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    return d.toLocaleDateString("en-US", {
      weekday: "long", month: "short", day: "numeric", year: "numeric",
      timeZone: HIVE_TIME_ZONE
    });
  }

  /* ------------------------------------------------------------------
     Word list indexing — precompute a 26-bit letter mask per word so
     puzzle generation and word validation are cheap bitwise checks.
     ------------------------------------------------------------------ */
  const VOWELS = new Set(["a", "e", "i", "o", "u"]);
  const LETTER_FREQ = { a:9,b:2,c:2,d:4,e:12,f:2,g:3,h:2,i:9,j:1,k:1,l:4,m:2,
    n:6,o:8,p:2,q:1,r:6,s:4,t:6,u:4,v:2,w:2,x:1,y:2,z:1 };

  const FREQ_POOL = [];
  Object.keys(LETTER_FREQ).forEach((c) => {
    for (let i = 0; i < LETTER_FREQ[c]; i++) FREQ_POOL.push(c);
  });

  function letterBit(ch) {
    return 1 << (ch.charCodeAt(0) - 97);
  }

  function wordMask(word) {
    let m = 0;
    for (let i = 0; i < word.length; i++) m |= letterBit(word[i]);
    return m;
  }

  const WORD_MASKS = new Array(WORD_LIST.length);
  for (let i = 0; i < WORD_LIST.length; i++) WORD_MASKS[i] = wordMask(WORD_LIST[i]);

  const WORD_SET = new Set(WORD_LIST);

  /* ------------------------------------------------------------------
     Daily puzzle generation
     ------------------------------------------------------------------ */
  function generatePuzzle(dateStr) {
    const rng = mulberry32(hashString(dateStr));
    const MIN_WORDS = 25;
    let best = null;

    for (let attempt = 0; attempt < 500; attempt++) {
      const pool = seededShuffle(FREQ_POOL.slice(), rng);
      const chosen = [];
      const seen = new Set();
      for (let i = 0; i < pool.length && chosen.length < 7; i++) {
        const c = pool[i];
        if (!seen.has(c)) {
          seen.add(c);
          chosen.push(c);
        }
      }
      const vowelCount = chosen.filter((c) => VOWELS.has(c)).length;
      if (vowelCount < 2 || vowelCount > 4) continue;

      const centerIndex = Math.floor(rng() * chosen.length);
      const center = chosen[centerIndex];
      const allowedMask = chosen.reduce((m, c) => m | letterBit(c), 0);
      const centerBit = letterBit(center);

      const valid = [];
      let pangramCount = 0;
      for (let i = 0; i < WORD_LIST.length; i++) {
        const wm = WORD_MASKS[i];
        if ((wm & ~allowedMask) !== 0) continue;
        if ((wm & centerBit) === 0) continue;
        valid.push(WORD_LIST[i]);
        if (wm === allowedMask) pangramCount++;
      }

      if (!best || valid.length > best.valid.length) {
        best = { letters: chosen.slice(), center, valid, pangramCount, allowedMask };
      }

      if (valid.length >= MIN_WORDS && pangramCount >= 1) {
        return { letters: chosen, center, valid, pangramCount, allowedMask };
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------
     Scoring
     ------------------------------------------------------------------ */
  function isPangram(word, allowedMask) {
    return wordMask(word) === allowedMask;
  }

  function scoreWord(word, allowedMask) {
    let pts = word.length === 4 ? 1 : word.length;
    if (isPangram(word, allowedMask)) pts += 7;
    return pts;
  }

  const RANKS = [
    { label: "Beginner", pct: 0 },
    { label: "Good Start", pct: 0.02 },
    { label: "Moving Up", pct: 0.05 },
    { label: "Good", pct: 0.08 },
    { label: "Solid", pct: 0.15 },
    { label: "Nice", pct: 0.25 },
    { label: "Great", pct: 0.40 },
    { label: "Amazing", pct: 0.50 },
    { label: "Genius", pct: 0.70 },
    { label: "Queen Bee", pct: 1.0 },
  ];

  function getRank(score, maxScore) {
    if (maxScore <= 0) return RANKS[0].label;
    const pct = score / maxScore;
    let label = RANKS[0].label;
    for (const r of RANKS) {
      if (pct >= r.pct) label = r.label;
    }
    return label;
  }

  /* ------------------------------------------------------------------
     App state
     ------------------------------------------------------------------ */
  const dateStr = todayHiveString();
  const puzzle = generatePuzzle(dateStr);
  const maxScore = puzzle.valid.reduce((sum, w) => sum + scoreWord(w, puzzle.allowedMask), 0);

  let displayOrder = puzzle.letters.slice(); // outer letters can be shuffled visually
  let currentWord = "";
  let foundWords = []; // { word, points, pangram }
  let score = 0;
  const ROUND_DURATION = 90;
  let timeLeft = ROUND_DURATION;
  let timerHandle = null;
  let roundActive = false;

  /* ------------------------------------------------------------------
     DOM refs
     ------------------------------------------------------------------ */
  const $ = (id) => document.getElementById(id);

  const puzzleDateEl = $("puzzleDate");
  const nextHiveEl = $("nextHiveCountdown");

  const startScreen = $("startScreen");
  const playScreen = $("playScreen");
  const endScreen = $("endScreen");

  const startBtn = $("startBtn");

  const scoreValueEl = $("scoreValue");
  const timerValueEl = $("timerValue");
  const rankValueEl = $("rankValue");
  const timerStatEl = document.querySelector(".stat-timer");

  const hiveEl = $("hive");
  const messageEl = $("message");
  const entryDisplayEl = $("entryDisplay");
  const entryPlaceholderEl = $("entryPlaceholder");

  const deleteBtn = $("deleteBtn");
  const clearBtn = $("clearBtn");
  const shuffleBtn = $("shuffleBtn");
  const enterBtn = $("enterBtn");

  const foundListEl = $("foundList");
  const foundCountEl = $("foundCount");

  const finalWordCountEl = $("finalWordCount");
  const finalScoreEl = $("finalScore");
  const finalRankEl = $("finalRank");
  const pangramNoteEl = $("pangramNote");
  const submitScoreForm = $("submitScoreForm");
  const playerNameInput = $("playerName");
  const saveConfirmEl = $("saveConfirm");
  const playAgainBtn = $("playAgainBtn");

  const leaderboardDateEl = $("leaderboardDate");
  const leaderboardListEl = $("leaderboardList");
  const leaderboardEmptyEl = $("leaderboardEmpty");

  /* ------------------------------------------------------------------
     Header: date + countdown to next hive
     ------------------------------------------------------------------ */
  puzzleDateEl.textContent = formatDateHuman(dateStr);
  leaderboardDateEl.textContent = formatDateHuman(dateStr);

  function tickNextHive() {
    // The countdown is calculated from the current time, so it remains
    // positive after midnight. Detect the date rollover separately so the
    // puzzle and leaderboard refresh for the new hive.
    if (todayHiveString() !== dateStr) {
      window.location.reload();
      return;
    }

    const ms = msUntilNextHiveMidnight();
    if (ms <= 0) {
      window.location.reload();
      return;
    }
    // Round up so the display never claims midnight has arrived early.
    const totalSec = Math.ceil(ms / 1000);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    nextHiveEl.textContent = `${h}:${m}:${s}`;
  }
  tickNextHive();
  setInterval(tickNextHive, 250);

  /* ------------------------------------------------------------------
     Render honeycomb
     ------------------------------------------------------------------ */
  function wireLetterButton(button, ch) {
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") {
        event.preventDefault();
        tapLetter(ch);
      }
    });
    button.addEventListener("click", (event) => {
      // Pointer activation handles touch and pen input immediately.
      if (event.detail === 0 || !("PointerEvent" in window)) {
        tapLetter(ch);
      }
    });
  }

  function renderHive() {
    hiveEl.innerHTML = "";

    const centerBtn = document.createElement("button");
    centerBtn.type = "button";
    centerBtn.className = "hex-btn is-center hex-pos-0";
    centerBtn.textContent = puzzle.center.toUpperCase();
    centerBtn.setAttribute("aria-label", `Letter ${puzzle.center.toUpperCase()} (required)`);
    wireLetterButton(centerBtn, puzzle.center);
    hiveEl.appendChild(centerBtn);

    const outer = displayOrder.filter((c) => c !== puzzle.center);
    outer.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `hex-btn hex-pos-${i + 1}`;
      btn.textContent = c.toUpperCase();
      btn.setAttribute("aria-label", `Letter ${c.toUpperCase()}`);
      wireLetterButton(btn, c);
      hiveEl.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------
     Entry display
     ------------------------------------------------------------------ */
  function renderEntry() {
    if (!currentWord) {
      entryDisplayEl.innerHTML = "";
      entryDisplayEl.appendChild(entryPlaceholderEl);
      return;
    }
    entryDisplayEl.innerHTML = "";
    for (const ch of currentWord) {
      const span = document.createElement("span");
      span.textContent = ch;
      if (ch === puzzle.center) span.className = "entry-center";
      entryDisplayEl.appendChild(span);
    }
  }

  function shakeEntry() {
    entryDisplayEl.classList.remove("is-shake");
    void entryDisplayEl.offsetWidth;
    entryDisplayEl.classList.add("is-shake");
  }

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = "message" + (type ? " is-" + type : "");
    void messageEl.offsetWidth;
    messageEl.classList.add("is-visible");
  }

  /* ------------------------------------------------------------------
     Letter input
     ------------------------------------------------------------------ */
  function tapLetter(ch) {
    if (!roundActive) return;
    currentWord += ch;
    renderEntry();
  }

  function deleteLetter() {
    if (!roundActive) return;
    currentWord = currentWord.slice(0, -1);
    renderEntry();
  }

  function clearEntry() {
    currentWord = "";
    renderEntry();
  }

  function rejectWord(text) {
    showMessage(text, "bad");
    shakeEntry();
    clearEntry();
  }

  function submitWord() {
    if (!roundActive) return;
    const word = currentWord.toLowerCase();

    if (word.length === 0) return;
    if (word.length < 4) {
      rejectWord("Too short — 4 letters minimum");
      return;
    }
    if (!word.includes(puzzle.center)) {
      rejectWord(`Missing center letter "${puzzle.center.toUpperCase()}"`);
      return;
    }
    const allowed = new Set(puzzle.letters);
    const hasOnlyAllowed = [...word].every((c) => allowed.has(c));
    if (!hasOnlyAllowed) {
      rejectWord("Uses letters outside the hive");
      return;
    }
    if (foundWords.some((f) => f.word === word)) {
      rejectWord("Already found that one");
      return;
    }
    if (!WORD_SET.has(word)) {
      rejectWord("Not in the word list");
      return;
    }

    const pangram = isPangram(word, puzzle.allowedMask);
    const pts = scoreWord(word, puzzle.allowedMask);
    foundWords.unshift({ word, points: pts, pangram });
    score += pts;
    clearEntry();
    renderFound();
    updateStatusBar();
    showMessage(pangram ? `Pangram! +${pts} points` : `Nice! +${pts} points`, "good");
  }

  function renderFound() {
    foundListEl.innerHTML = "";
    foundWords.forEach((f) => {
      const li = document.createElement("li");
      if (f.pangram) li.classList.add("is-pangram");
      const wordSpan = document.createElement("span");
      wordSpan.textContent = f.word;
      const ptsSpan = document.createElement("span");
      ptsSpan.className = "pts";
      ptsSpan.textContent = f.points;
      li.appendChild(wordSpan);
      li.appendChild(ptsSpan);
      foundListEl.appendChild(li);
    });
    foundCountEl.textContent = `(${foundWords.length})`;
  }

  function updateStatusBar() {
    scoreValueEl.textContent = score;
    rankValueEl.textContent = getRank(score, maxScore);
  }

  /* ------------------------------------------------------------------
     Shuffle button — cosmetic reorder of outer letters
     ------------------------------------------------------------------ */
  function shuffleOuter() {
    const outerIdx = displayOrder
      .map((c, i) => (c !== puzzle.center ? i : -1))
      .filter((i) => i !== -1);
    const values = outerIdx.map((i) => displayOrder[i]);
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    outerIdx.forEach((idx, k) => (displayOrder[idx] = values[k]));
    hiveEl.classList.remove("is-shuffling");
    void hiveEl.offsetWidth;
    hiveEl.classList.add("is-shuffling");
    renderHive();
  }

  /* ------------------------------------------------------------------
     Timer / round lifecycle
     ------------------------------------------------------------------ */
  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function startRound() {
    score = 0;
    foundWords = [];
    currentWord = "";
    timeLeft = ROUND_DURATION;
    roundActive = true;

    renderHive();
    renderEntry();
    renderFound();
    updateStatusBar();
    timerValueEl.textContent = formatTime(timeLeft);
    timerStatEl.classList.remove("is-low");

    startScreen.classList.add("hidden");
    endScreen.classList.add("hidden");
    playScreen.classList.remove("hidden");

    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      timeLeft -= 1;
      timerValueEl.textContent = formatTime(Math.max(timeLeft, 0));
      if (timeLeft <= 10) timerStatEl.classList.add("is-low");
      if (timeLeft <= 0) endRound();
    }, 1000);
  }

  function endRound() {
    roundActive = false;
    clearInterval(timerHandle);

    finalWordCountEl.textContent = foundWords.length;
    finalScoreEl.textContent = score;
    finalRankEl.textContent = getRank(score, maxScore);
    const hasPangram = foundWords.some((f) => f.pangram);
    pangramNoteEl.classList.toggle("hidden", !hasPangram);
    saveConfirmEl.classList.add("hidden");
    playerNameInput.value = "";

    playScreen.classList.add("hidden");
    endScreen.classList.remove("hidden");

    renderLeaderboard();
  }

  /* ------------------------------------------------------------------
     Leaderboard (shared through Supabase, with a local fallback)
     ------------------------------------------------------------------ */
  const LEADERBOARD_SEED_URL = "leaderboard.txt";
  const supabaseConfig = window.WORDHIVE_SUPABASE || {};
  const supabaseEnabled = Boolean(supabaseConfig.url && supabaseConfig.anonKey);

  function leaderboardKey() {
    return `wordhive-leaderboard-${dateStr}`;
  }

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(leaderboardKey());
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLeaderboard(entries) {
    try {
      localStorage.setItem(leaderboardKey(), JSON.stringify(entries));
    } catch (e) {
      console.warn("Word Hive could not save leaderboard entries.", e);
    }
  }

  function leaderboardHeaders() {
    return {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      "Content-Type": "application/json"
    };
  }

  async function loadSharedLeaderboard() {
    if (!supabaseEnabled) return false;

    const url = `${supabaseConfig.url.replace(/\/$/, "")}/rest/v1/leaderboard` +
      `?select=name,score,words,pangram,created_at&date=eq.${dateStr}` +
      "&order=score.desc,created_at.asc&limit=50";
    const response = await fetch(url, {
      headers: leaderboardHeaders(),
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Supabase leaderboard request failed (${response.status})`);
    }

    const sharedEntries = await response.json();
    saveLeaderboard(sharedEntries.map((entry) => ({
      name: String(entry.name).slice(0, 20) || "Anonymous",
      score: Math.max(0, Math.floor(Number(entry.score) || 0)),
      words: Math.max(0, Math.floor(Number(entry.words) || 0)),
      pangram: entry.pangram === true,
      ts: Date.parse(entry.created_at) || 0
    })));
    renderLeaderboard();
    return true;
  }

  async function saveSharedLeaderboard(name, entryScore, wordCount, pangram) {
    const url = `${supabaseConfig.url.replace(/\/$/, "")}/rest/v1/leaderboard`;
    const response = await fetch(url, {
      method: "POST",
      headers: { ...leaderboardHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        date: dateStr,
        name: name.slice(0, 20),
        score: entryScore,
        words: wordCount,
        pangram
      })
    });
    if (!response.ok) {
      throw new Error(`Supabase score submission failed (${response.status})`);
    }
    await loadSharedLeaderboard();
  }

  function parseLeaderboardSeed(text) {
    return text.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [date, name, scoreText, wordsText, pangramText] = line.split("|");
        const scoreValue = Number(scoreText);
        const wordCount = Number(wordsText);
        if (date !== dateStr || !name || !Number.isFinite(scoreValue) ||
            !Number.isInteger(wordCount) || wordCount < 0) return null;
        return {
          name: name.trim().slice(0, 20) || "Anonymous",
          score: Math.max(0, Math.floor(scoreValue)),
          words: wordCount,
          pangram: pangramText === "true",
          ts: 0
        };
      })
      .filter(Boolean);
  }

  async function loadLeaderboardSeed() {
    try {
      const response = await fetch(LEADERBOARD_SEED_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const seededEntries = parseLeaderboardSeed(await response.text());
      if (seededEntries.length === 0) return;

      const localEntries = loadLeaderboard();
      const seen = new Set();
      const entries = [...seededEntries, ...localEntries].filter((entry) => {
        const key = `${entry.name}|${entry.score}|${entry.words}|${entry.pangram}|${entry.ts === 0 ? "seed" : entry.ts}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      entries.sort((a, b) => b.score - a.score || a.ts - b.ts);
      saveLeaderboard(entries.slice(0, 50));
      renderLeaderboard();
    } catch (e) {
      console.warn("Word Hive could not load leaderboard.txt; using local scores.", e);
    }
  }

  function addLocalLeaderboardEntry(name, entryScore, wordCount, pangram) {
    const entries = loadLeaderboard();
    entries.push({ name, score: entryScore, words: wordCount, pangram, ts: Date.now() });
    entries.sort((a, b) => b.score - a.score);
    saveLeaderboard(entries.slice(0, 50));
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const entries = loadLeaderboard().slice(0, 10);
    leaderboardListEl.innerHTML = "";
    leaderboardEmptyEl.classList.toggle("hidden", entries.length > 0);

    entries.forEach((entry, i) => {
      const li = document.createElement("li");

      const rank = document.createElement("span");
      rank.className = "lb-rank";
      rank.textContent = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);

      const name = document.createElement("span");
      name.className = "lb-name";
      name.textContent = entry.name + (entry.pangram ? " 🐝" : "");

      const words = document.createElement("span");
      words.className = "lb-words";
      words.textContent = `${entry.words}w`;

      const scoreEl = document.createElement("span");
      scoreEl.className = "lb-score";
      scoreEl.textContent = entry.score;

      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(words);
      li.appendChild(scoreEl);
      leaderboardListEl.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------
     Event wiring
     ------------------------------------------------------------------ */
  startBtn.addEventListener("click", startRound);
  playAgainBtn.addEventListener("click", () => {
    startScreen.classList.remove("hidden");
    endScreen.classList.add("hidden");
  });

  deleteBtn.addEventListener("click", deleteLetter);
  clearBtn.addEventListener("click", clearEntry);
  shuffleBtn.addEventListener("click", () => {
    shuffleBtn.classList.remove("is-spinning");
    void shuffleBtn.offsetWidth;
    shuffleBtn.classList.add("is-spinning");
    shuffleOuter();
  });
  enterBtn.addEventListener("click", submitWord);

  document.addEventListener("keydown", (e) => {
    if (!roundActive) return;
    if (playScreen.classList.contains("hidden")) return;
    if (document.activeElement === playerNameInput) return;

    const key = e.key.toLowerCase();
    if (key === "enter") {
      e.preventDefault();
      submitWord();
    } else if (key === "backspace") {
      e.preventDefault();
      deleteLetter();
    } else if (/^[a-z]$/.test(key)) {
      if (puzzle.letters.includes(key)) {
        tapLetter(key);
      } else {
        shakeEntry();
      }
    }
  });

  submitScoreForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim() || "Anonymous";
    const hasPangram = foundWords.some((f) => f.pangram);
    const saveButton = submitScoreForm.querySelector("button[type='submit']");
    saveButton.disabled = true;
    try {
      if (supabaseEnabled) {
        await saveSharedLeaderboard(name, score, foundWords.length, hasPangram);
      } else {
        addLocalLeaderboardEntry(name, score, foundWords.length, hasPangram);
      }
      saveConfirmEl.textContent = "Saved to the leaderboard.";
      saveConfirmEl.classList.remove("hidden");
    } catch (error) {
      console.warn("Word Hive could not save the shared score.", error);
      saveConfirmEl.textContent = "Could not save the score. Please try again.";
      saveConfirmEl.classList.remove("hidden");
    } finally {
      saveButton.disabled = false;
    }
  });

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  timerValueEl.textContent = formatTime(ROUND_DURATION);
  renderLeaderboard();
  loadLeaderboardSeed().then(async () => {
    if (!supabaseEnabled) return;
    try {
      await loadSharedLeaderboard();
    } catch (error) {
      console.warn("Word Hive could not load the shared leaderboard.", error);
    }
  });
})();
