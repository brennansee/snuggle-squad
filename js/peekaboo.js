/* Peek-a-Boo! Tap the pillows to help Peek find Boo.
   Real artwork is picked up automatically from images/pillow-game/ (see the
   README there); anything missing is drawn with a simple stand-in instead.
   The silly items under the wrong pillows are drawn in code.
   Plain JS, no libraries. Sounds are synthesised with Web Audio, plus optional
   voice clips from audio/. */
(() => {
  const stage = document.getElementById("pb");
  if (!stage) return;
  const $ = (id) => document.getElementById(id);

  const pillowsEl = $("pb-pillows");
  const peekEl = $("pb-peek");
  const peekImg = $("pb-peek-img");
  const sayEl = $("pb-say");
  const roundEl = $("pb-round");
  const soundBtn = $("pb-sound");
  const screens = { start: $("pb-start-screen"), found: $("pb-found-screen"), win: $("pb-win-screen") };

  /* ---------- settings ---------- */
  const ROUNDS = [3, 4, 5, 6];  // pillows per round
  const HINT_AFTER = 2;         // wrong guesses before Boo's ears start peeking out
  const PILLOW_COLORS = ["#ffc6e0", "#c9b6ff", "#a8dcff", "#bff0d3", "#ffe08a", "#ffd0a8"];

  /* ---------- artwork: drop files into images/pillow-game/ ---------- */
  const ART_DIR = "images/pillow-game/";
  const ART = {
    background: "background.jpg",
    pillow: "pillow.webp",
    peek: {
      searching: "peek-searching.webp",
      hmm: "peek-hmm.webp",
      startled: "peek-startled.webp",
      fallen: "peek-fallen.webp",
      cheer: "peek-cheer.webp",
    },
    boo: {
      pop: "boo-pop.webp",
      giggle: "boo-giggle.webp",
      peek: "boo-peek.webp",
    },
  };
  // Silly things under the wrong pillows: drawn below (ITEM_ART), or item-<id>.png if one is added
  const ITEMS = [
    { id: "duck", name: "a rubber duck" },
    { id: "sock", name: "a stripy sock" },
    { id: "toast", name: "a slice of toast" },
    { id: "snail", name: "a snoozing snail" },
    { id: "toothbrush", name: "a toothbrush" },
    { id: "slipper", name: "a lost slipper" },
    { id: "teddy", name: "a teddy bear" },
    { id: "fish", name: "a very surprised fish" },
  ];
  // Optional voice clips; synthesised sounds play until these exist
  const CLIPS = { boo: "audio/boo.mp3", giggle: "audio/giggle.mp3" };

  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const svgUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const capitalise = (s) => s[0].toUpperCase() + s.slice(1);

  /* ---------- stand-in drawings (used until the real art arrives) ---------- */
  function peekSVG(pose) {
    const skin = "#ffd2b8", suit = "#ff5fae", ink = "#2b1a4a";
    const fallen = pose === "fallen";
    const dy = fallen ? 26 : 0; // she sits lower when she's landed on her bum
    const hands = {
      searching: [[84, 94], [116, 94]],
      hmm: [[62, 198], [128, 64]],
      startled: [[44, 70], [156, 70]],
      fallen: [[46, 196], [154, 200]],
      cheer: [[50, 60], [150, 60]],
    }[pose];
    const feet = fallen ? [[140, 200], [164, 220]] : [[84, 236], [116, 236]];
    const hips = fallen ? [[90, 222], [110, 226]] : [[86, 200], [114, 200]];
    const face = {
      searching: `<g fill="#7b3fe0"><circle cx="86" cy="92" r="14"/><circle cx="114" cy="92" r="14"/><rect x="92" y="86" width="16" height="10" rx="3"/></g>
        <g fill="${ink}"><circle cx="86" cy="92" r="7"/><circle cx="114" cy="92" r="7"/></g>
        <path d="M92 114q8 7 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
      hmm: `<g fill="${ink}"><circle cx="86" cy="92" r="5"/><circle cx="114" cy="92" r="5"/></g>
        <path d="M78 80l14 3M122 78l-12 4M90 114q6-4 10 0t10 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
        <text x="158" y="44" font-family="Fredoka, sans-serif" font-weight="700" font-size="40" fill="#5b2fd6">?</text>`,
      startled: `<g fill="#fff" stroke="${ink}" stroke-width="2"><circle cx="86" cy="90" r="11"/><circle cx="114" cy="90" r="11"/></g>
        <g fill="${ink}"><circle cx="86" cy="90" r="5"/><circle cx="114" cy="90" r="5"/><ellipse cx="100" cy="116" rx="8" ry="10"/></g>`,
      fallen: `<path d="M80 92a6 6 0 1 1 6 6a3 3 0 1 1 -3-3M108 92a6 6 0 1 1 6 6a3 3 0 1 1 -3-3M90 116q5-5 10 0t10 0" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
      cheer: `<path d="M79 93q7-9 14 0M107 93q7-9 14 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
        <path d="M86 108q14 18 28 0z" fill="${ink}"/>`,
    }[pose];
    const arm = ([x, y], [sx, sy]) => `<path d="M${sx} ${sy}L${x} ${y}" stroke="${suit}" stroke-width="16" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="9" fill="${skin}"/>`;
    return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260">
      ${hips.map(([hx, hy], i) => `<path d="M${hx} ${hy}L${feet[i][0]} ${feet[i][1]}" stroke="${suit}" stroke-width="20" stroke-linecap="round"/>
        <ellipse cx="${feet[i][0]}" cy="${feet[i][1] + 4}" rx="15" ry="9" fill="#a35cf0"/>`).join("")}
      <g transform="translate(0 ${dy})">
        <ellipse cx="146" cy="126" rx="30" ry="52" fill="#fff" stroke="#d6e4ff" stroke-width="3"/>
        <rect x="68" y="128" width="64" height="80" rx="30" fill="${suit}"/>
        <g fill="#fff" opacity=".9"><circle cx="86" cy="160" r="5"/><circle cx="112" cy="176" r="5"/><circle cx="92" cy="192" r="4"/></g>
        ${arm(hands[0], [78, 148])}${arm(hands[1], [122, 148])}
        <ellipse cx="108" cy="80" rx="58" ry="46" fill="#fff" stroke="#d6e4ff" stroke-width="3"/>
        <circle cx="66" cy="58" r="11" fill="#ffe2d0"/><circle cx="134" cy="58" r="11" fill="#ffe2d0"/>
        <circle cx="100" cy="94" r="42" fill="${skin}"/>
        <path d="M60 86q4-36 40-38q34 2 42 30q-24-20-82 8z" fill="#fff"/>
        <g fill="#ff4f9a"><circle cx="72" cy="62" r="6"/><circle cx="88" cy="53" r="6"/><circle cx="106" cy="50" r="6"/><circle cx="124" cy="54" r="7"/></g>
        <g fill="#ff9ab8" opacity=".6"><circle cx="76" cy="108" r="6"/><circle cx="124" cy="108" r="6"/></g>
        ${face}
      </g></svg>`);
  }

  function booSVG(pose) {
    const ink = "#3a1e5c";
    const ears = `<g fill="#b48cf0"><ellipse cx="76" cy="52" rx="17" ry="42" transform="rotate(-14 76 52)"/><ellipse cx="124" cy="52" rx="17" ry="42" transform="rotate(14 124 52)"/></g>
      <g fill="#f4a6d0"><ellipse cx="76" cy="56" rx="8" ry="30" transform="rotate(-14 76 56)"/><ellipse cx="124" cy="56" rx="8" ry="30" transform="rotate(14 124 56)"/></g>`;
    if (pose === "peek") {
      // just the ears and a pair of eyes, for peeking over a pillow
      return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130">${ears}
        <path d="M50 130V96Q50 78 70 80H130Q150 78 150 96V130Z" fill="#fff" stroke="#b9b3e6" stroke-width="4"/>
        <g fill="#fff" stroke="${ink}" stroke-width="2"><circle cx="84" cy="112" r="11"/><circle cx="116" cy="112" r="11"/></g>
        <g fill="${ink}"><circle cx="86" cy="114" r="5"/><circle cx="118" cy="114" r="5"/></g></svg>`);
    }
    const pop = pose === "pop";
    const hands = pop ? [[30, 104], [170, 104]] : [[40, 152], [160, 152]];
    const face = pop
      ? `<g fill="#fff" stroke="${ink}" stroke-width="2"><circle cx="84" cy="118" r="14"/><circle cx="116" cy="118" r="14"/></g>
         <g fill="#7b3fe0"><circle cx="86" cy="120" r="7"/><circle cx="118" cy="120" r="7"/></g>
         <ellipse cx="100" cy="162" rx="15" ry="19" fill="${ink}"/><ellipse cx="100" cy="172" rx="9" ry="6" fill="#c46bd6"/>`
      : `<path d="M74 120q10-10 20 0M106 120q10-10 20 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
         <path d="M84 150q16 20 32 0z" fill="${ink}"/>`;
    return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">${ears}
      <path d="M50 96Q50 78 70 80H130Q150 78 150 96L156 196Q158 214 142 210Q130 222 118 210Q100 224 84 210Q70 222 58 210Q42 214 44 196Z" fill="#fff" stroke="#b9b3e6" stroke-width="4"/>
      ${hands.map(([x, y]) => `<g fill="#fff" stroke="#b9b3e6" stroke-width="3"><circle cx="${x}" cy="${y}" r="14"/><circle cx="${x - 8}" cy="${y - 10}" r="7"/><circle cx="${x + 8}" cy="${y - 10}" r="7"/></g>`).join("")}
      ${face}</svg>`);
  }

  // A plump white pillow; the code tints it to each pillow's colour
  const PILLOW_SVG = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
    <path d="M18 28Q100 2 182 28Q198 70 182 112Q100 138 18 112Q2 70 18 28Z" fill="#fff" stroke="#cfc6e6" stroke-width="4"/>
    <path d="M30 104Q100 126 170 104Q182 70 170 36" fill="none" stroke="#e6e0f2" stroke-width="10" stroke-linecap="round"/>
    <path d="M34 40Q100 20 166 40Q178 70 166 100Q100 120 34 100Q22 70 34 40Z" fill="none" stroke="#ddd5ee" stroke-width="2.5" stroke-dasharray="6 6"/>
    <ellipse cx="72" cy="48" rx="26" ry="9" fill="#fff" opacity=".9"/></svg>`);

  /* ---------- the silly items, as cute cartoon drawings ---------- */
  const OUTLINE = `stroke="#5b3a7a" stroke-width="2.5" stroke-linejoin="round"`;
  const happyFace = (x, y, gap = 12) => `<g fill="#3a2350"><circle cx="${x}" cy="${y}" r="2.6"/><circle cx="${x + gap}" cy="${y}" r="2.6"/></g>
    <path d="M${x + gap / 2 - 4} ${y + 6}q4 4 8 0" fill="none" stroke="#3a2350" stroke-width="2.2" stroke-linecap="round"/>
    <g fill="#ff8fb8" opacity=".6"><circle cx="${x - 5}" cy="${y + 5}" r="3"/><circle cx="${x + gap + 5}" cy="${y + 5}" r="3"/></g>`;
  const ITEM_ART = {
    duck: `<path d="M84 52q10-6 8 8q-2 8-12 6z" fill="#ffd84d" ${OUTLINE}/>
      <ellipse cx="54" cy="66" rx="32" ry="20" fill="#ffd84d" ${OUTLINE}/>
      <circle cx="36" cy="38" r="17" fill="#ffd84d" ${OUTLINE}/>
      <path d="M21 39q-14 1-12 7q4 5 13 1z" fill="#ff9a3c" ${OUTLINE}/>
      <path d="M48 64q14-12 24 2q-10 10-24-2z" fill="#ffc21f"/>
      <circle cx="34" cy="34" r="3.2" fill="#3a2350"/><circle cx="35" cy="33" r="1" fill="#fff"/>
      <circle cx="40" cy="44" r="3.5" fill="#ff8fb8" opacity=".6"/>
      <path d="M14 88q10-6 20 0t20 0t20 0t20 0" fill="none" stroke="#8fd0ff" stroke-width="3" stroke-linecap="round"/>`,
    sock: `<clipPath id="s"><path d="M36 14Q36 10 40 10H60Q64 10 64 14V54L82 72Q92 82 84 90Q76 96 66 88L42 66Q36 60 36 52Z"/></clipPath>
      <path d="M36 14Q36 10 40 10H60Q64 10 64 14V54L82 72Q92 82 84 90Q76 96 66 88L42 66Q36 60 36 52Z" fill="#fff"/>
      <g clip-path="url(#s)"><g fill="#ff7ec2"><rect x="0" y="24" width="100" height="8"/><rect x="0" y="52" width="100" height="8"/><rect x="0" y="80" width="100" height="8"/></g>
        <g fill="#9b72f7"><rect x="0" y="38" width="100" height="8"/><rect x="0" y="66" width="100" height="8"/></g></g>
      <path d="M36 14Q36 10 40 10H60Q64 10 64 14V54L82 72Q92 82 84 90Q76 96 66 88L42 66Q36 60 36 52Z" fill="none" ${OUTLINE}/>
      <rect x="33" y="6" width="34" height="13" rx="6" fill="#ffcde6" ${OUTLINE}/>`,
    toast: `<path d="M20 42Q12 18 34 16Q50 4 66 16Q88 18 80 42V82Q80 90 72 90H28Q20 90 20 82Z" fill="#e2a35a" ${OUTLINE}/>
      <path d="M27 44Q21 25 37 23Q50 13 63 23Q79 25 73 44V83H27Z" fill="#ffe1a8"/>
      ${happyFace(43, 48, 14)}
      <rect x="39" y="64" width="22" height="13" rx="4" fill="#fff3a0" stroke="#e6c84a" stroke-width="2"/>
      <path d="M43 68h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    snail: `<path d="M8 84Q8 72 22 72L80 72Q94 74 92 84Q60 90 8 84Z" fill="#ffd9b0" ${OUTLINE}/>
      <path d="M79 58L74 38M87 58L92 40" stroke="#ffd9b0" stroke-width="5" stroke-linecap="round"/>
      <circle cx="74" cy="37" r="4" fill="#ffd9b0" ${OUTLINE}/><circle cx="92" cy="39" r="4" fill="#ffd9b0" ${OUTLINE}/>
      <circle cx="83" cy="66" r="12" fill="#ffd9b0" ${OUTLINE}/>
      <path d="M76 65q3 3 6 0M84 65q3 3 6 0" fill="none" stroke="#3a2350" stroke-width="2" stroke-linecap="round"/>
      <circle cx="44" cy="54" r="25" fill="#c4a8ff" ${OUTLINE}/>
      <path d="M44 54m-4 0a4 4 0 1 1 8 0a8 8 0 1 1-16 0a12 12 0 1 1 24 0a16 16 0 1 1-32 0" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round"/>
      <g fill="#8b5cf6" font-family="Fredoka, sans-serif" font-weight="700"><text x="60" y="26" font-size="12">z</text><text x="68" y="16" font-size="16">Z</text></g>`,
    toothbrush: `<g transform="rotate(-28 50 50)">
        <rect x="10" y="50" width="62" height="13" rx="6.5" fill="#5cbcff" ${OUTLINE}/>
        <rect x="66" y="46" width="22" height="18" rx="5" fill="#5cbcff" ${OUTLINE}/>
        <rect x="67" y="32" width="20" height="15" rx="2" fill="#fff" ${OUTLINE}/>
        <path d="M72 34v11M77 34v11M82 34v11" stroke="#a8dcff" stroke-width="2"/>
        <path d="M66 32q3-12 9-5q5-9 13 5z" fill="#ff9fd0" ${OUTLINE}/>
        <path d="M71 28q4-3 8 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
        ${happyFace(28, 54, 10)}</g>`,
    slipper: `<path d="M8 70Q8 50 30 48L62 44Q92 42 93 66Q93 78 80 79H18Q8 79 8 70Z" fill="#ff7ec2" ${OUTLINE}/>
      <ellipse cx="34" cy="50" rx="20" ry="7" fill="#9c2f6a" ${OUTLINE}/>
      <g fill="#fff" ${OUTLINE}><circle cx="16" cy="50" r="5"/><circle cx="24" cy="45" r="5"/><circle cx="34" cy="43" r="5"/><circle cx="44" cy="45" r="5"/><circle cx="52" cy="50" r="5"/></g>
      <circle cx="84" cy="52" r="9" fill="#fff" ${OUTLINE}/>
      <path d="M9 74Q11 86 22 86H80Q93 86 93 72" fill="none" stroke="#8b5cf6" stroke-width="7" stroke-linecap="round"/>
      ${happyFace(62, 61, 11)}`,
    teddy: `<g fill="#c98a4b" ${OUTLINE}><circle cx="29" cy="22" r="10"/><circle cx="71" cy="22" r="10"/>
        <ellipse cx="22" cy="74" rx="9" ry="7"/><ellipse cx="78" cy="74" rx="9" ry="7"/>
        <ellipse cx="50" cy="78" rx="25" ry="18"/><circle cx="50" cy="42" r="24"/></g>
      <g fill="#f1c58e"><circle cx="29" cy="22" r="5"/><circle cx="71" cy="22" r="5"/><ellipse cx="50" cy="80" rx="13" ry="10"/><ellipse cx="50" cy="51" rx="11" ry="8"/></g>
      <ellipse cx="50" cy="47" rx="4.5" ry="3.2" fill="#3a2350"/>
      <g fill="#3a2350"><circle cx="41" cy="37" r="3"/><circle cx="59" cy="37" r="3"/></g>
      <path d="M46 53q4 4 8 0" fill="none" stroke="#3a2350" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M50 64l-9-5v10zM50 64l9-5v10z" fill="#ff7ec2" ${OUTLINE}/>`,
    fish: `<g fill="#cfeeff" stroke="#8fd0ff" stroke-width="2"><circle cx="12" cy="34" r="4"/><circle cx="18" cy="22" r="3"/><circle cx="10" cy="13" r="2"/></g>
      <path d="M72 54L94 36Q88 54 94 72Z" fill="#ffb36b" ${OUTLINE}/>
      <path d="M36 35Q48 20 60 35" fill="#ffb36b" ${OUTLINE}/>
      <ellipse cx="46" cy="55" rx="30" ry="22" fill="#ff9a3c" ${OUTLINE}/>
      <path d="M56 38q6 17 0 34M64 42q4 13 0 26" fill="none" stroke="#ffd0a8" stroke-width="3" stroke-linecap="round"/>
      <circle cx="33" cy="48" r="9" fill="#fff" ${OUTLINE}/><circle cx="33" cy="48" r="4" fill="#3a2350"/><circle cx="34.5" cy="46.5" r="1.4" fill="#fff"/>
      <path d="M25 35q8-6 16 0" fill="none" stroke="#5b3a7a" stroke-width="2.5" stroke-linecap="round"/>
      <ellipse cx="19" cy="62" rx="4.5" ry="5.5" fill="#3a2350"/>`,
  };
  const itemSVG = (id) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${ITEM_ART[id]}</svg>`);

  /* ---------- load real art where it exists ---------- */
  const probe = (src) => new Promise((done) => {
    const img = new Image();
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = src;
  });
  const art = { peek: {}, boo: {}, items: {} };
  async function loadArt() {
    const jobs = [];
    const use = (file, fallback, set) => jobs.push(probe(ART_DIR + file).then((ok) => set(ok ? ART_DIR + file : fallback)));
    use(ART.background, null, (src) => src && ($("pb-bg").src = src));
    use(ART.pillow, PILLOW_SVG, (src) => {
      art.pillow = src;
      art.tintPillows = src === PILLOW_SVG; // the real pillow keeps its own colours
    });
    for (const pose of Object.keys(ART.peek)) use(ART.peek[pose], peekSVG(pose), (src) => (art.peek[pose] = src));
    for (const pose of Object.keys(ART.boo)) use(ART.boo[pose], booSVG(pose), (src) => (art.boo[pose] = src));
    for (const item of ITEMS) use(`item-${item.id}.png`, itemSVG(item.id), (src) => (art.items[item.id] = src));
    await Promise.all(jobs);
    // the real fallen pose has its own dizzy swirl, so the drawn one is only for the stand-in
    stage.classList.toggle("has-peek-art", art.peek.fallen.startsWith(ART_DIR));
  }

  /* ---------- sound ---------- */
  let audio = null;
  let muted = false;
  const clips = {};
  for (const [name, src] of Object.entries(CLIPS)) {
    const clip = new Audio();
    clip.preload = "auto";
    clip.addEventListener("canplaythrough", () => (clips[name] = clip), { once: true });
    clip.src = src;
  }
  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) audio = new AC();
    if (audio.state === "suspended") audio.resume();
  }
  function tone(freq, at, dur, vol, type = "triangle", slideTo = 0) {
    if (!audio || muted) return;
    const t = audio.currentTime + at;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }
  // soft "fwump" of a pillow being lifted: a short burst of filtered noise
  function fwump() {
    if (!audio || muted) return;
    const len = audio.sampleRate * 0.25;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.value = 0.5;
    src.buffer = buf;
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
  }
  function playClip(name) {
    const clip = clips[name];
    if (!clip || muted) return false;
    clip.currentTime = 0;
    clip.play().catch(() => {});
    return true;
  }
  const sound = {
    lift: fwump,
    boing: () => { tone(220, 0, 0.35, 0.16, "sine", 520); tone(520, 0.12, 0.25, 0.08, "sine", 300); },
    boo: () => {
      if (playClip("boo")) return;
      tone(180, 0, 0.35, 0.12, "sawtooth", 720);
      [523.25, 659.25, 783.99].forEach((f) => tone(f, 0.18, 0.4, 0.07));
    },
    thud: () => { tone(120, 0, 0.25, 0.3, "sine", 50); fwump(); },
    giggle: () => {
      if (playClip("giggle")) return;
      [988, 1175, 988, 1319, 1175].forEach((f, i) => tone(f, i * 0.09, 0.09, 0.07, "sine"));
    },
    hint: () => [1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.08, 0.04, "sine")),
    fanfare: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.13, 0.5, 0.11)),
  };
  soundBtn.addEventListener("click", () => {
    muted = !muted;
    soundBtn.textContent = muted ? "🔇" : "🔊";
    soundBtn.setAttribute("aria-pressed", String(muted));
    soundBtn.setAttribute("aria-label", muted ? "Sound off. Tap to unmute" : "Sound on. Tap to mute");
    if (!muted) initAudio();
  });

  /* ---------- Peek ---------- */
  let sayTimer = null;
  let poseTimer = null;
  function setPeek(pose) {
    peekEl.dataset.pose = pose;
    peekImg.src = art.peek[pose];
  }
  function say(text, ms = 0) {
    clearTimeout(sayTimer);
    sayEl.textContent = text;
    sayEl.classList.toggle("is-on", Boolean(text));
    if (ms) sayTimer = setTimeout(() => sayEl.classList.remove("is-on"), ms);
  }

  /* ---------- rounds ---------- */
  let state = "idle"; // idle | playing | found | done
  let round = 0;
  let booAt = 0;
  let tries = 0;
  let wrong = 0;
  let hintTimer = null;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  function clearTimers() {
    timers.splice(0).forEach(clearTimeout);
    clearInterval(hintTimer);
    clearTimeout(poseTimer);
  }
  function setState(next) {
    state = next;
    stage.dataset.state = next;
  }
  function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
  }

  function buildPillows(count) {
    pillowsEl.textContent = "";
    pillowsEl.dataset.count = count;
    const items = shuffle(ITEMS).slice(0, count - 1);
    const colors = shuffle(PILLOW_COLORS);
    booAt = Math.floor(Math.random() * count);
    for (let i = 0; i < count; i++) {
      const isBoo = i === booAt;
      const item = isBoo ? null : items.shift();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pb-pillow";
      btn.style.setProperty("--c", colors[i % colors.length]);
      btn.style.setProperty("--d", `${rand(0, 1.5).toFixed(2)}s`);
      btn.setAttribute("aria-label", `Pillow ${i + 1}`);
      btn.dataset.index = i;

      let under;
      if (isBoo) {
        under = `<img class="pb-boo" src="${art.boo.pop}" alt="">
          <span class="pb-boo-say" aria-hidden="true">BOO!</span>
          <img class="pb-hint" src="${art.boo.peek}" alt="">`;
      } else {
        under = `<img class="pb-item" src="${art.items[item.id]}" alt="">`;
      }
      btn.innerHTML = `<span class="pb-under">${under}</span>
        <span class="pb-cover"><img src="${art.pillow}" alt="">${art.tintPillows
          ? `<i class="pb-tint" style="-webkit-mask-image:url('${art.pillow}');mask-image:url('${art.pillow}')"></i>` : ""}</span>`;
      btn.item = item;
      pillowsEl.appendChild(btn);
    }
  }

  function startRound(n) {
    initAudio();
    clearTimers();
    round = n;
    tries = 0;
    wrong = 0;
    roundEl.textContent = `Round ${n + 1} of ${ROUNDS.length}`;
    buildPillows(ROUNDS[n]);
    setPeek("searching");
    say(n === 0 ? "Where's Boo? Tap a pillow!" : "Boo's hiding again! Where could he be?");
    setState("playing");
    showScreen(null);
    pillowsEl.querySelector(".pb-pillow").focus({ preventScroll: true });
  }

  pillowsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".pb-pillow");
    if (!btn || state !== "playing" || btn.classList.contains("is-open")) return;
    tries += 1;
    btn.classList.add("is-open");
    btn.disabled = true;
    sound.lift();
    if (Number(btn.dataset.index) === booAt) foundBoo(btn);
    else missed(btn);
  });

  function missed(btn) {
    wrong += 1;
    btn.setAttribute("aria-label", `Pillow ${Number(btn.dataset.index) + 1}: ${btn.item.name}`);
    later(sound.boing, 250);
    setPeek("hmm");
    say(`${capitalise(btn.item.name)}! No Boo here…`);
    clearTimeout(poseTimer);
    poseTimer = setTimeout(() => state === "playing" && setPeek("searching"), 1300);
    if (wrong === HINT_AFTER) startHint();
  }

  // Boo can't help himself: his ears pop up over his pillow every few seconds
  function startHint() {
    const booPillow = pillowsEl.children[booAt];
    const peekOut = () => {
      if (state !== "playing") return;
      booPillow.classList.remove("is-hinting");
      void booPillow.offsetWidth; // restart the animation
      booPillow.classList.add("is-hinting");
      sound.hint();
    };
    later(peekOut, 900);
    hintTimer = setInterval(peekOut, 3200);
    later(() => state === "playing" && say("Did you see that? Something wiggled…", 2600), 1200);
  }

  function foundBoo(btn) {
    setState("found");
    clearInterval(hintTimer);
    clearTimeout(poseTimer);
    btn.classList.remove("is-hinting");
    btn.setAttribute("aria-label", `Pillow ${booAt + 1}: Boo!`);
    pillowsEl.classList.add("has-found");

    // BOO! … Peek jumps … and lands on her bum while Boo giggles
    later(() => { btn.classList.add("is-boo"); sound.boo(); }, 200);
    later(() => { setPeek("startled"); say("EEK!"); }, 350);
    later(() => { setPeek("fallen"); sound.thud(); say("Whoa! Boo, you got me!"); }, 950);
    later(() => { btn.querySelector(".pb-boo").src = art.boo.giggle; sound.giggle(); }, 1250);
    later(() => { setPeek("cheer"); say("Found you, Boo!"); }, 2600);
    later(roundOver, 3300);
  }

  function roundOver() {
    if (round === ROUNDS.length - 1) {
      setState("done");
      sparkle(screens.win.querySelector(".celebrate"), 40, false);
      showScreen("win");
      sound.fanfare();
      $("pb-replay").focus({ preventScroll: true });
      return;
    }
    $("pb-found-msg").textContent = tries === 1 ? "First try! Super spotting!" : `Found him in ${tries} tries!`;
    sparkle(screens.found.querySelector(".celebrate"), 20, true);
    showScreen("found");
    sound.fanfare();
    $("pb-next").focus({ preventScroll: true });
  }

  // Sparkles round the result cards (styles shared with Stomp Catcher)
  function sparkle(box, count, edgesOnly) {
    const colors = ["#ffd24d", "#ff8cc6", "#b28cff", "#6cc4ff"];
    box.textContent = "";
    for (let i = 0; i < count; i++) {
      let x = rand(0, 100);
      let y = rand(0, 100);
      if (edgesOnly) {
        if (Math.random() < 0.5) y = Math.random() < 0.5 ? rand(0, 12) : rand(88, 100);
        else x = Math.random() < 0.5 ? rand(0, 10) : rand(90, 100);
      }
      const s = document.createElement("i");
      s.className = "spark";
      s.style.cssText = [
        `--x:${x.toFixed(1)}%`, `--y:${y.toFixed(1)}%`, `--s:${rand(16, edgesOnly ? 30 : 38).toFixed(0)}px`,
        `--c:${colors[i % colors.length]}`, `--d:${rand(1.2, 2.2).toFixed(2)}s`, `--del:-${rand(0, 2).toFixed(2)}s`,
      ].join(";");
      box.appendChild(s);
    }
  }

  /* ---------- go ---------- */
  const startBtn = $("pb-start");
  startBtn.disabled = true;
  loadArt().then(() => {
    setPeek("searching");
    buildPillows(ROUNDS[0]); // show the first pillows behind the start card
    startBtn.disabled = false;
    startBtn.focus({ preventScroll: true });
  });
  startBtn.addEventListener("click", () => startRound(0));
  $("pb-next").addEventListener("click", () => startRound(round + 1));
  $("pb-replay").addEventListener("click", () => startRound(0));
})();
