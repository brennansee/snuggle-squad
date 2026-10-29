/* The Stuffy Boos — site scripts */

/* ---------------------------------------------------------
   SIGN-UP SETTINGS
   Paste your email provider's form endpoint here (Mailchimp,
   ConvertKit, Buttondown, Formspree, etc.). While this is empty
   the form works visually but does NOT store emails.
   --------------------------------------------------------- */
const SIGNUP_ENDPOINT = "";

/* Mobile nav */
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    document.querySelector(".site-header").classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "✕" : "☰";
  });
}

/* Image slots: show the real <img> once it loads, otherwise keep the
   placeholder. Drop files into /images and they appear automatically. */
document.querySelectorAll(".art").forEach((art) => {
  const img = art.querySelector("img");
  if (!img) return;
  const ok = () => art.classList.add("has-image");
  if (img.complete && img.naturalWidth > 0) ok();
  else img.addEventListener("load", ok);
});

/* Character cards: a few of each character's symbol floating in the card.
   Spots sit round the rim and under the words, where the picture won't hide them. */
const CARD_SPOTS = [[9, 7], [91, 9], [5, 40], [95, 46], [8, 78], [92, 84], [30, 95], [70, 92]];
document.querySelectorAll("[data-symbol]").forEach((card) => {
  const sky = document.createElement("div");
  sky.className = "card-sky";
  sky.setAttribute("aria-hidden", "true");
  CARD_SPOTS.forEach(([x, y]) => {
    const r = (a, b) => a + Math.random() * (b - a);
    const sym = document.createElement("i");
    sym.className = "card-sym";
    sym.style.cssText = [
      `--x:${(x + r(-3, 3)).toFixed(1)}%`, `--y:${(y + r(-3, 3)).toFixed(1)}%`,
      `--s:${r(16, 36).toFixed(0)}px`,
      `--d:${r(4, 8).toFixed(1)}s`, `--del:-${r(0, 8).toFixed(1)}s`,
    ].join(";");
    sky.appendChild(sym);
  });
  card.prepend(sky);
});

/* Footer year */
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

/* Email sign-up */
const form = document.querySelector("#signup-form");
if (form) {
  const msg = form.querySelector(".form-msg");
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    msg.className = "form-msg";

    if (data.get("website")) return; // honeypot: bots fill this in
    const email = String(data.get("email") || "").trim();

    if (!emailRe.test(email)) {
      msg.textContent = "Oops! That email doesn't look quite right.";
      msg.classList.add("error");
      return;
    }
    if (!data.get("adult")) {
      msg.textContent = "Please confirm you're a parent or guardian.";
      msg.classList.add("error");
      return;
    }

    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    msg.textContent = "Sending…";

    try {
      if (SIGNUP_ENDPOINT) {
        const res = await fetch(SIGNUP_ENDPOINT, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: data,
        });
        if (!res.ok) throw new Error("Request failed");
      } else {
        console.info("[Stuffy Boos] No SIGNUP_ENDPOINT set — signup not stored:", email);
      }
      form.hidden = true;
      document.querySelector("#signup-success").hidden = false;
    } catch (err) {
      button.disabled = false;
      msg.textContent = "Something went wrong. Please try again in a moment.";
      msg.classList.add("error");
    }
  });
}

/* Nav: frosted over the hero, solid once the page scrolls */
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* Ambient sky: slow pastel stars, crescent moons and rising sparkles.
   Sparkles are skipped for visitors who prefer reduced motion (CSS also
   switches every animation off). */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PASTELS = ["#ffe58a", "#ffb3d8", "#cbb4ff", "#a8d8ff"]; // yellow, pink, lavender, blue
const SKY_PRESETS = {
  hero:  { stars: 10, moons: 1, sparkles: 26, colors: ["#ffe08a", "#ffd36e", "#ffc6e0", "#fff3cf"] }, // warm dusk golds
  soft:  { stars: 5,  moons: 2, sparkles: 6,  colors: PASTELS.slice(1) }, // no yellow on cream
  night: { stars: 6,  moons: 2, sparkles: 8,  colors: PASTELS },
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

document.querySelectorAll("[data-sky]").forEach((sky) => {
  const preset = SKY_PRESETS[sky.dataset.sky] || SKY_PRESETS.soft;
  const scale = window.innerWidth < 600 ? 0.65 : 1;

  const add = (kind, count, size) => {
    for (let i = 0; i < Math.round(count * scale); i++) {
      const el = document.createElement("span");
      el.className = `sk ${kind}`;
      el.style.cssText = [
        `left:${rand(2, 96).toFixed(1)}%`,
        `top:${rand(4, 86).toFixed(1)}%`,
        `--s:${rand(...size).toFixed(0)}px`,
        `--c:${pick(preset.colors)}`,
        `--r:${rand(-25, 25).toFixed(0)}deg`,
        `--fx:${rand(-16, 16).toFixed(0)}px`,
        `--fd:${rand(9, 16).toFixed(1)}s`, `--fdel:-${rand(0, 16).toFixed(1)}s`,
        `--td:${rand(5, 9).toFixed(1)}s`,  `--tdel:-${rand(0, 9).toFixed(1)}s`,
      ].join(";");
      el.innerHTML = "<i></i>";
      sky.appendChild(el);
    }
  };
  add("star", preset.stars, [14, 28]);
  add("moon", preset.moons, [26, 44]);

  if (!reduceMotion) {
    for (let i = 0; i < Math.round(preset.sparkles * scale); i++) {
      const el = document.createElement("span");
      el.className = "sk sparkle";
      el.style.cssText = [
        `left:${rand(2, 98).toFixed(1)}%`,
        `--s:${rand(5, 12).toFixed(0)}px`,
        `--c:${pick(preset.colors)}`,
        `--dx:${rand(-40, 40).toFixed(0)}px`,
        `--rd:${rand(18, 32).toFixed(1)}s`, `--rdel:-${rand(0, 32).toFixed(1)}s`,
      ].join(";");
      sky.appendChild(el);
    }
    // Save battery: only animate while the section is on screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        sky.classList.toggle("is-paused", !entry.isIntersecting);
      }).observe(sky);
    }
  }
});
