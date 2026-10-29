/* Home page hero: magical effects over the Pillow Patch picture.
   - glowing lights, star glints and twinkles pinned to spots in the picture
   - fireflies drifting low over the scene
   - shooting stars streaking across the sky
   Visitors who prefer reduced motion get the glows without the movement. */
(() => {
  const hero = document.querySelector(".hero");
  const img = hero && hero.querySelector(".hero-bg");
  const scene = hero && hero.querySelector(".hero-scene");
  const sky = hero && hero.querySelector(".hero-shooting");
  if (!hero || !img || !scene || !sky) return;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const small = window.innerWidth < 600;

  /* Keep the effects layer exactly over the picture, however object-fit: cover crops it */
  function fitScene() {
    const W = hero.clientWidth, H = hero.clientHeight;
    const iw = img.naturalWidth || 1376, ih = img.naturalHeight || 768;
    const k = Math.max(W / iw, H / ih);
    const w = iw * k, h = ih * k;
    const [px, py] = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
    Object.assign(scene.style, {
      width: `${w}px`, height: `${h}px`,
      left: `${(W - w) * (isNaN(px) ? 0.5 : px)}px`, top: `${(H - h) * (isNaN(py) ? 0.5 : py)}px`,
    });
  }
  fitScene();
  window.addEventListener("resize", fitScene);
  img.addEventListener("load", fitScene);

  const add = (cls, vars, inner = "") => {
    const el = document.createElement("span");
    el.className = cls;
    el.style.cssText = Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(";");
    el.innerHTML = inner;
    scene.appendChild(el);
  };

  /* Glowing lights over the picture's light sources: [x %, y %, size % of picture width, colour] */
  const LIGHTS = [
    [52.5, 80, 11, "warm"],   // the golden front door
    [54, 22, 14, "cool"],     // the glowing dome
    [30, 19.5, 12, "warm"],   // the smiling sun
    [48, 53.5, 4.5, "pink"],  // the little balcony window
    [7.5, 49, 5, "warm"],     // lantern on the left hill
    [14.5, 52, 3.5, "warm"],
    [11.5, 88, 4.5, "warm"],  // path lights, bottom left
    [16.5, 85, 3, "warm"],
    [82.5, 52, 3.5, "warm"],  // path lights, right
    [88, 57, 3, "warm"],
    [91.5, 88, 4.5, "warm"],
    [64, 45, 3, "pink"],
  ];
  LIGHTS.forEach(([x, y, s, c]) => add(`fx-glow fx-glow--${c}`, {
    x: `${x}%`, y: `${y}%`, s: `${s}%`, d: `${rnd(2.4, 4.2).toFixed(2)}s`, del: `-${rnd(0, 4).toFixed(2)}s`,
  }));

  /* Glints on the hanging golden stars */
  const STARS = [[13.6, 3], [18, 6], [21, 12.5], [34.9, 6.7], [35.5, 13.5], [39.6, 6.3], [50, 13],
                 [59.9, 6], [61.5, 11], [78.9, 13], [80, 5.8], [94.2, 5]];
  STARS.forEach(([x, y]) => add("fx-glint", {
    x: `${x}%`, y: `${y}%`, s: `${rnd(18, 30).toFixed(0)}px`, d: `${rnd(2.6, 5).toFixed(2)}s`, del: `-${rnd(0, 5).toFixed(2)}s`,
  }, "<i></i>"));

  /* Twinkles among the fairy lights around the tower's cloud ring */
  for (let i = 0; i < (small ? 8 : 16); i++) {
    const a = rnd(0, Math.PI * 2);
    add("fx-glint fx-glint--tiny", {
      x: `${(54 + Math.cos(a) * rnd(8, 15)).toFixed(1)}%`, y: `${(32 + Math.sin(a) * rnd(5, 9)).toFixed(1)}%`,
      s: `${rnd(10, 16).toFixed(0)}px`, d: `${rnd(1.8, 3.6).toFixed(2)}s`, del: `-${rnd(0, 3.6).toFixed(2)}s`,
    }, "<i></i>");
  }

  /* Fireflies drifting low over the hills */
  for (let i = 0; i < (small ? 8 : 16); i++) {
    add("fx-firefly", {
      x: `${rnd(4, 96).toFixed(1)}%`, y: `${rnd(55, 95).toFixed(1)}%`,
      dx: `${rnd(-60, 60).toFixed(0)}px`, dy: `${rnd(-50, 10).toFixed(0)}px`,
      d: `${rnd(6, 11).toFixed(1)}s`, b: `${rnd(1.6, 3).toFixed(2)}s`, del: `-${rnd(0, 11).toFixed(1)}s`,
    });
  }

  /* Shooting stars, every few seconds, while the hero is on screen */
  if (still) return;
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  function shoot() {
    if (visible && !document.hidden) {
      const s = document.createElement("span");
      const angle = rnd(14, 32);                       // heading down and to the right
      const dist = rnd(320, 620);
      s.className = "fx-shoot";
      s.style.cssText = [
        `left:${rnd(-5, 70).toFixed(1)}%`, `top:${rnd(2, 32).toFixed(1)}%`,
        `--a:${angle.toFixed(1)}deg`, `--len:${rnd(110, 200).toFixed(0)}px`,
        `--dx:${(Math.cos(angle * Math.PI / 180) * dist).toFixed(0)}px`,
        `--dy:${(Math.sin(angle * Math.PI / 180) * dist).toFixed(0)}px`,
        `--t:${rnd(0.8, 1.3).toFixed(2)}s`,
      ].join(";");
      sky.appendChild(s);
      s.addEventListener("animationend", () => s.remove());
    }
    setTimeout(shoot, rnd(2200, 5500));
  }
  setTimeout(shoot, 1200);
})();
