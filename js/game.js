/* Stomp Catcher: tap falling paw prints and stomping boots to collect Stomps.
   Five levels, each with its own clock, target, speed and scenery.
   Plain JS, no libraries. Sounds are synthesised with Web Audio (no files). */
(() => {
  const stage = document.getElementById("game");
  if (!stage) return;
  const $ = (id) => document.getElementById(id);

  const field = $("game-field");
  const fx = stage.querySelector(".game-fx");
  const glow = stage.querySelector(".game-glow");
  const levelEl = $("game-level");
  const scoreEl = $("game-score");
  const timeEl = $("game-time");
  const soundBtn = $("game-sound");
  const countEl = $("level-count");
  const screens = {
    start: $("game-start-screen"),
    level: $("game-level-screen"),
    pass: $("game-pass-screen"),
    fail: $("game-fail-screen"),
    win: $("game-win-screen"),
  };

  /* ---------- levels ----------
     time    seconds on the clock
     target  Stomps needed to pass
     fall    seconds an object takes to cross the screen [min, max]
     every   milliseconds between new objects [min, max]
     start   objects already falling when the level begins
     gold    chance a new object is a golden paw (+3)
     angry   chance a new object is an angry red footprint (−2)
     chaos   objects drift sideways, wobble harder and sometimes arrive in pairs
     The scenery for each level lives in css/styles.css ([data-level]). */
  const LEVELS = [
    { time: 20, target: 15, fall: [9, 11],    every: [850, 1100], start: 5, gold: 0.04, angry: 0.05,
      tip: "Tap the paw prints and boots before they stomp away!" },
    { time: 25, target: 22, fall: [7, 8.5],   every: [700, 900],  start: 5, gold: 0.05, angry: 0.07,
      tip: "The sun is setting, and everything is falling faster!" },
    { time: 30, target: 30, fall: [5.8, 7],   every: [520, 680],  start: 6, gold: 0.06, angry: 0.08,
      tip: "Dusk in the Pillow Patch. More Stomps than ever!" },
    { time: 25, target: 30, fall: [4.8, 5.8], every: [460, 600],  start: 7, gold: 0.07, angry: 0.17,
      tip: "Night has fallen. Watch out for angry red footprints!" },
    { time: 20, target: 28, fall: [3.6, 4.6], every: [330, 450],  start: 8, gold: 0.13, angry: 0.2, chaos: true,
      tip: "Enchanted night! Grab the golden paws and dodge the angry footprints." },
  ];

  const POINTS = { paw: 1, boot: 2, gold: 3, angry: -2 };
  // regular objects: 5 paws to every 2 boots
  const TYPES = ["paw", "paw", "paw", "boot", "boot", "paw", "paw"];
  const PASTEL = ["#ffe27a", "#ffb3d9", "#c7b0ff", "#9fd6ff"]; // yellow, pink, lavender, blue
  const BRIGHT = ["#ffd24d", "#ff8cc6", "#b28cff", "#6cc4ff"];  // the same, turned up for celebrations
  const COLORS = {
    boot: ["#8b5cf6", "#7c4dff", "#9d6bff"],
    angry: ["#ff5a5f", "#f2464f"],
  };
  // The Squad's paws (+1, one picked at random) and the golden bonus paw (+3):
  // paw colour, a deeper shade for the symbol's outline, and the symbol in the middle
  const PAWS = [
    { who: "Snugg", c: "#5cb6f5", deep: "#1f5fa8", symbol: "moon" },
    { who: "Bloom", c: "#ff7ec2", deep: "#b8206f", symbol: "heart" },
    { who: "Pip",   c: "#9b72f7", deep: "#5b2fd6", symbol: "cloud" },
    { who: "Ray",   c: "#ff8a3d", deep: "#a8420a", symbol: "sun" },
    { who: "Ziggy", c: "#4fcf86", deep: "#19744a", symbol: "star" },
  ];
  const GOLD_PAW = { c: "#ffd23f", deep: "#a87400", symbol: "sparkle" }; // brighter and yellower than Ray's orange

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const stomps = (n) => `${n} ${n === 1 ? "Stomp" : "Stomps"}`;

  /* ---------- the falling things (with little faces) ---------- */
  // Cartoon footprint, toes up: a sole with an arch, and five toes
  const FOOT = `<g class="body"><path d="M52 36C69 36 75 48 72 62C69 75 66 94 50 94C37 94 34 82 37 71C39.5 63 31 57 32 48C33 40 42 36 52 36Z"/>
      <circle cx="36" cy="23" r="10"/><circle cx="52.5" cy="18" r="8"/><circle cx="65" cy="21" r="7"/><circle cx="75" cy="28" r="6"/><circle cx="81" cy="38" r="5"/></g>`;
  // Cute paw print: one big main pad with the character's symbol in it, four toe pads on top
  const SYMBOLS = {
    moon: `<path d="M16 3.5a9 9 0 1 0 4.6 16A7.6 7.6 0 0 1 16 3.5Z"/>`,
    heart: `<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.2 1.7-2 3.1-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z"/>`,
    cloud: `<path d="M6.5 19A4.5 4.5 0 0 1 6 10.1A6 6 0 0 1 17.4 9A4.6 4.6 0 0 1 18 19Z"/>`,
    sun: `<circle cx="12" cy="12" r="4.8"/><path class="rays" d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8l2.1 2.1M17.1 17.1l2.1 2.1M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1"/>`,
    star: `<path d="M12 2.5L14.8 8.6 21.4 9.3 16.4 13.8 17.9 20.3 12 17 6.1 20.3 7.6 13.8 2.6 9.3 9.2 8.6Z"/>`,
    sparkle: `<path d="M12 .5L14.6 9.4 23.5 12 14.6 14.6 12 23.5 9.4 14.6 .5 12 9.4 9.4Z"/>`,
  };
  const pawSVG = (symbol) => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <g class="body"><path d="M50 44C66 44 81 56 81 71C81 85 69 92 58 89C54 88 52 86 50 86C48 86 46 88 42 89C31 92 19 85 19 71C19 56 34 44 50 44Z"/>
        <ellipse cx="22" cy="40" rx="9" ry="11.5" transform="rotate(-28 22 40)"/><ellipse cx="39" cy="24" rx="9.5" ry="12.5" transform="rotate(-9 39 24)"/>
        <ellipse cx="61" cy="24" rx="9.5" ry="12.5" transform="rotate(9 61 24)"/><ellipse cx="78" cy="40" rx="9" ry="11.5" transform="rotate(28 78 40)"/></g>
      <g class="toe-shine"><ellipse cx="36" cy="19" rx="3" ry="4.5" transform="rotate(-9 36 19)"/><ellipse cx="58" cy="19" rx="3" ry="4.5" transform="rotate(9 58 19)"/></g>
      <g class="sym" transform="translate(36 54) scale(1.17)">${SYMBOLS[symbol]}</g></svg>`;

  const SHAPES = {
    // purple stomping boot, side on, toe pointing right
    boot: `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path class="body" d="M34 10H56Q62 10 62 16V50Q62 56 68 57L80 59Q92 61 92 72V80H28V16Q28 10 34 10Z"/>
      <rect class="sole" x="24" y="78" width="72" height="12" rx="6"/>
      <rect class="cuff" x="25" y="6" width="40" height="11" rx="5.5"/>
      <path class="shine" d="M74 64q8 1 12 7"/>
      <path class="face" d="M37 38q4 -4 8 0M50 38q4 -4 8 0M41 47q6 6 12 0"/>
      <circle class="blush" cx="35" cy="46" r="3.5"/><circle class="blush" cx="59" cy="46" r="3.5"/></svg>`,
    // cross little red footprint: frowny brows, don't tap it!
    angry: `<svg viewBox="0 0 100 100" aria-hidden="true">${FOOT}
      <circle class="eye" cx="46" cy="59" r="3.2"/><circle class="eye" cx="60" cy="59" r="3.2"/>
      <path class="face" d="M40 51l9 4M66 51l-9 4M47 72q6 -6 12 0"/></svg>`,
  };

  // Icons on the start screen's "what to catch" list
  document.querySelectorAll("[data-shape]").forEach((el) => {
    const shape = el.dataset.shape;
    if (shape === "paw" || shape === "gold") {
      const paw = shape === "gold" ? GOLD_PAW : PAWS.find((p) => p.symbol === el.dataset.symbol) || PAWS[0];
      el.classList.add("shape--paw");
      el.style.setProperty("--c", paw.c);
      el.style.setProperty("--deep", paw.deep);
      el.innerHTML = pawSVG(paw.symbol);
    } else {
      el.innerHTML = SHAPES[shape];
    }
  });

  /* ---------- sound ---------- */
  let audio = null;
  let muted = false;
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0]; // C major pentatonic: always sounds happy

  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) audio = new AC();
    if (audio.state === "suspended") audio.resume();
  }
  function tone(freq, when, dur, vol, type) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  }
  // Plays [frequency, start offset, duration, volume] notes
  function play(notes, type = "triangle") {
    if (!audio || muted) return;
    const t = audio.currentTime;
    notes.forEach(([f, at, dur, vol]) => tone(f, t + at, dur, vol, type));
  }
  const sound = {
    catch() {
      const f = pick(NOTES);
      play([[f, 0, 0.3, 0.14], [f * 1.5, 0.07, 0.34, 0.11]]);
      play([[f * 3, 0.07, 0.22, 0.03]], "sine");
    },
    gold() {
      play([[783.99, 0, 0.3, 0.12], [987.77, 0.06, 0.3, 0.12], [1318.5, 0.12, 0.45, 0.12]]);
      play([[2637, 0.12, 0.3, 0.03]], "sine");
    },
    // a soft thump under the chime for boots
    stomp() {
      play([[110, 0, 0.2, 0.25], [82.41, 0.04, 0.22, 0.2]], "sine");
      sound.catch();
    },
    oops: () => play([[311.13, 0, 0.18, 0.16], [233.08, 0.09, 0.32, 0.16]], "sine"),
    count: () => play([[659.25, 0, 0.16, 0.1]]),
    go: () => play([[1046.5, 0, 0.4, 0.11], [1318.5, 0.05, 0.4, 0.06]]),
    pass() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        play([[f, i * 0.13, 0.5, 0.12]]);
        play([[f * 2, i * 0.13, 0.3, 0.03]], "sine");
      });
    },
    fail: () => play([[659.25, 0, 0.35, 0.1], [523.25, 0.2, 0.35, 0.1], [440, 0.4, 0.6, 0.1]]),
    win() {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        const at = i * 0.13 + (i > 3 ? 0.12 : 0);
        play([[f, at, i === 6 ? 1.1 : 0.45, 0.12]]);
        play([[f * 2, at, 0.3, 0.03]], "sine");
      });
    },
  };

  soundBtn.addEventListener("click", () => {
    muted = !muted;
    soundBtn.textContent = muted ? "🔇" : "🔊";
    soundBtn.setAttribute("aria-pressed", String(muted));
    soundBtn.setAttribute("aria-label", muted ? "Sound off. Tap to unmute" : "Sound on. Tap to mute");
    if (!muted) initAudio();
  });

  /* ---------- game state ---------- */
  let state = "idle"; // idle | countdown | playing | passed | failed | won
  let level = 0;      // index into LEVELS
  let score = 0;      // this level
  let total = 0;      // across passed levels this run
  let startAt = 0;
  let nextSpawn = 0;
  let timer = null;
  let countTimer = null;
  let pausedAt = null;

  function setState(next) {
    state = next;
    stage.dataset.state = next;
  }
  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  }
  function clearTimers() {
    clearInterval(timer);
    clearTimeout(countTimer);
  }

  function showScore(delta = 0) {
    const { target } = LEVELS[level];
    const met = score >= target;
    scoreEl.textContent = `${score} / ${target} ✨`;
    scoreEl.style.setProperty("--p", `${Math.min(100, (score / target) * 100)}%`);
    scoreEl.classList.toggle("met", met);
    glow.style.opacity = Math.min(0.55, (score / target) * 0.55);
    if (reduceMotion || !delta) return;
    scoreEl.animate(
      delta > 0
        ? [{ transform: "scale(1.16)" }, { transform: "scale(1)" }]
        : [{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-4px)" }, { transform: "none" }],
      { duration: delta > 0 ? 220 : 300, easing: "ease-out" }
    );
  }

  function pickType(cfg) {
    const r = Math.random();
    if (r < cfg.gold) return "gold";
    if (r < cfg.gold + cfg.angry) return "angry";
    return pick(TYPES);
  }

  function spawn(initial) {
    const w = field.clientWidth;
    const h = field.clientHeight;
    if (!w || !h) return;
    const cfg = LEVELS[level];
    const type = pickType(cfg);
    const size = Math.max(66, Math.min(104, Math.min(w, h) * 0.13));
    const width = type === "boot" ? size * 1.1 : size; // boots are a touch wider than tall
    const x = rand(6, Math.max(7, w - width - 26));
    let dur = rand(...cfg.fall) * (reduceMotion ? 1.3 : 1);
    if (type === "gold") dur *= 0.65; // golden paws are in a hurry
    if (type === "boot") dur *= 0.85; // boots stomp down a little faster
    const delay = initial ? -dur * rand(0.08, 0.5) : 0; // opening batch starts part-way down
    // chaos: drift sideways while falling, but never off the edge
    const drift = cfg.chaos ? Math.max(-x, Math.min(w - width - 26 - x, rand(-0.3, 0.3) * w)) : 0;

    const el = document.createElement("div");
    const paw = type === "gold" ? GOLD_PAW : type === "paw" ? pick(PAWS) : null;
    el.className = `orb shape shape--${type}${paw ? " shape--paw" : ""}`;
    el.dataset.type = type;
    el.dataset.burst = type === "gold" ? "#ffd24d" : "";
    el.style.cssText = [
      `--x:${x.toFixed(0)}px`, `--w:${width.toFixed(0)}px`,
      `--c:${paw ? paw.c : pick(COLORS[type])}`, paw ? `--deep:${paw.deep}` : "",
      `--dur:${dur.toFixed(2)}s`, `--delay:${delay.toFixed(2)}s`, `--drift:${drift.toFixed(0)}px`,
      `--sw:${(cfg.chaos ? rand(1.2, 2) : rand(2.6, 4.4)).toFixed(1)}s`, `--sd:-${rand(0, 4).toFixed(1)}s`,
      `--amp:${(cfg.chaos ? rand(20, 40) : rand(8, 22)).toFixed(0)}px`,
    ].join(";");
    el.innerHTML = `<span class="orb-body">${paw ? pawSVG(paw.symbol) : SHAPES[type]}</span>`;
    field.appendChild(el);
  }

  // Missed ones float off the bottom and disappear
  field.addEventListener("animationend", (e) => {
    if (e.animationName === "game-fall") e.target.remove();
  });

  /* ---------- catching ---------- */
  function burst(x, y, color, { count = 10, oops = false } = {}) {
    const b = document.createElement("div");
    b.className = oops ? "burst burst--oops" : "burst";
    b.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
    for (let i = 0; i < count; i++) {
      // an angry footprint splats downwards; sparkles fly every way
      const a = oops ? rand(0.1, 0.9) * Math.PI : (i / count) * Math.PI * 2 + rand(-0.25, 0.25);
      const d = rand(46, 92);
      const p = document.createElement("i");
      p.style.cssText = [
        `--dx:${(Math.cos(a) * d).toFixed(0)}px`, `--dy:${(Math.sin(a) * d).toFixed(0)}px`,
        `--rot:${rand(-90, 90).toFixed(0)}deg`, `--z:${rand(9, 17).toFixed(0)}px`,
        `--c2:${oops ? "#ff8a8e" : pick(PASTEL)}`,
      ].join(";");
      b.appendChild(p);
    }
    fx.appendChild(b);
    setTimeout(() => b.remove(), 850);
  }

  // "+1", "+2", "+3" or "−2" floating up from the tap
  function popText(x, y, points) {
    const t = document.createElement("span");
    t.className = `pop-text${points < 0 ? " minus" : points === 3 ? " gold" : points === 2 ? " boot" : ""}`;
    t.style.cssText = `left:${x}px;top:${y}px`;
    t.textContent = points > 0 ? `+${points}` : `−${-points}`;
    fx.appendChild(t);
    setTimeout(() => t.remove(), 950);
  }

  // pointerdown covers mouse clicks and finger taps alike, with no tap delay
  field.addEventListener("pointerdown", (e) => {
    const orb = e.target.closest(".orb");
    if (!orb || state !== "playing") return;
    e.preventDefault();

    const type = orb.dataset.type;
    const points = POINTS[type];
    const box = stage.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    const color = orb.dataset.burst || orb.style.getPropertyValue("--c");
    orb.remove();

    if (type === "angry") {
      burst(x, y, color, { count: 9, oops: true });
      sound.oops();
    } else {
      burst(x, y, color, { count: type === "gold" ? 16 : 10 });
      if (type === "gold") sound.gold();
      else if (type === "boot") sound.stomp();
      else sound.catch();
    }
    popText(x, y, points);
    score = Math.max(0, score + points);
    showScore(points);
    if (score >= LEVELS[level].target) endLevel(); // goal reached: no need to wait for the clock
  });
  field.addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---------- sparkles for the pass / win screens ---------- */
  function sparkle(box, count, edgesOnly) {
    box.textContent = "";
    for (let i = 0; i < count; i++) {
      let x = rand(0, 100);
      let y = rand(0, 100);
      if (edgesOnly) {
        // keep them round the rim of the card, away from the words
        if (Math.random() < 0.5) y = Math.random() < 0.5 ? rand(0, 12) : rand(88, 100);
        else x = Math.random() < 0.5 ? rand(0, 10) : rand(90, 100);
      }
      const s = document.createElement("i");
      s.className = "spark";
      s.style.cssText = [
        `--x:${x.toFixed(1)}%`, `--y:${y.toFixed(1)}%`,
        `--s:${rand(16, edgesOnly ? 30 : 38).toFixed(0)}px`,
        `--c:${pick(BRIGHT)}`,
        `--d:${rand(1.2, 2.2).toFixed(2)}s`, `--del:-${rand(0, 2).toFixed(2)}s`,
      ].join(";");
      box.appendChild(s);
    }
  }

  /* ---------- level flow ---------- */
  function setLevel(n) {
    level = n;
    stage.dataset.level = String(n + 1); // CSS swaps the scenery from this
    levelEl.textContent = `Level ${n + 1}`;
  }

  // Level card + 3, 2, 1, Go! countdown, then the objects start falling
  function introLevel(n) {
    initAudio();
    clearTimers();
    if (n === 0) total = 0;
    setLevel(n);
    const cfg = LEVELS[n];
    field.textContent = "";
    fx.textContent = "";
    score = 0;
    showScore();
    timeEl.textContent = `⏱ ${cfg.time}s`;
    timeEl.classList.remove("low");

    $("level-title").textContent = `Level ${n + 1}`;
    $("level-target").textContent = `Catch ${cfg.target} Stomps!`;
    $("level-tip").textContent = cfg.tip;
    setState("countdown");
    showScreen("level");

    const steps = ["3", "2", "1", "Go!"];
    const next = () => {
      const step = steps.shift();
      if (!step) return beginLevel();
      countEl.textContent = step;
      step === "Go!" ? sound.go() : sound.count();
      if (!reduceMotion) {
        countEl.animate(
          [{ transform: "scale(0.4)", opacity: 0 }, { transform: "scale(1.15)", opacity: 1, offset: 0.35 }, { transform: "scale(1)", opacity: 1 }],
          { duration: 450, easing: "ease-out" }
        );
      }
      countTimer = setTimeout(next, step === "Go!" ? 600 : 900);
    };
    next();
  }

  function beginLevel() {
    setState("playing");
    showScreen(null);
    for (let i = 0; i < LEVELS[level].start; i++) spawn(true);
    startAt = performance.now();
    nextSpawn = startAt + 500;
    timer = setInterval(tick, 100);
  }

  function tick() {
    const now = performance.now();
    const cfg = LEVELS[level];
    const left = Math.max(0, cfg.time - (now - startAt) / 1000);
    timeEl.textContent = `⏱ ${Math.ceil(left)}s`;
    timeEl.classList.toggle("low", left <= 5);

    if (now >= nextSpawn) {
      spawn(false);
      if (cfg.chaos && Math.random() < 0.25) spawn(false);
      nextSpawn = now + rand(...cfg.every);
    }
    if (left <= 0) endLevel();
  }

  function endLevel() {
    clearTimers();
    field.textContent = "";
    timeEl.classList.remove("low");
    const { target } = LEVELS[level];

    if (score < target) {
      setState("failed");
      $("fail-score").textContent = stomps(score);
      $("fail-target").textContent = target;
      showScreen("fail");
      sound.fail();
      $("game-retry").focus({ preventScroll: true });
      return;
    }

    total += score;
    glow.style.opacity = 1;
    if (level === LEVELS.length - 1) {
      setState("won");
      $("win-total").textContent = stomps(total);
      sparkle(screens.win.querySelector(".celebrate"), 44, false);
      showScreen("win");
      sound.win();
      $("game-replay").focus({ preventScroll: true });
    } else {
      setState("passed");
      $("pass-score").textContent = stomps(score);
      sparkle(screens.pass.querySelector(".celebrate"), 24, true);
      showScreen("pass");
      sound.pass();
      $("game-next").focus({ preventScroll: true });
    }
  }

  // Pause if the player switches tabs, so the clock doesn't run out behind their back
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state === "playing") {
        pausedAt = performance.now();
        clearInterval(timer);
        stage.classList.add("is-paused");
      } else if (state === "countdown") {
        clearTimeout(countTimer);
        pausedAt = 0;
      }
    } else if (pausedAt !== null) {
      if (state === "playing") {
        const gap = performance.now() - pausedAt;
        startAt += gap;
        nextSpawn += gap;
        stage.classList.remove("is-paused");
        timer = setInterval(tick, 100);
      } else if (state === "countdown") {
        introLevel(level); // simply count down again
      }
      pausedAt = null;
    }
  });

  $("game-start").addEventListener("click", () => introLevel(0));
  $("game-next").addEventListener("click", () => introLevel(level + 1));
  $("game-retry").addEventListener("click", () => introLevel(level));
  $("game-replay").addEventListener("click", () => introLevel(0));

  setLevel(0);
  showScore();
  $("game-start").focus({ preventScroll: true });
})();
