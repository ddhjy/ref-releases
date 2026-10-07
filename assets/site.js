/* Ref — site behaviour. Everything here is progressive enhancement: the page
   reads and links correctly without it. */
(() => {
  "use strict";

  const zh = document.documentElement.lang.toLowerCase().startsWith("zh");
  const t = zh
    ? { copied: "已复制", copyFailed: "复制失败，请手动选择命令", openMenu: "打开菜单", closeMenu: "关闭菜单" }
    : { copied: "Copied", copyFailed: "Copy failed — select the command instead", openMenu: "Open menu", closeMenu: "Close menu" };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const live = document.querySelector(".sr-live");
  const announce = (text) => { if (live) { live.textContent = ""; requestAnimationFrame(() => { live.textContent = text; }); } };

  /* Header: a hairline once the page has moved. */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 4);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
  }

  /* Mobile navigation. */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("nav");
  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? t.closeMenu : t.openMenu);
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); toggle.focus(); } });
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("open") && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  /* Copy buttons. */
  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    try { if (!document.execCommand("copy")) throw new Error("execCommand"); }
    finally { area.remove(); }
  };
  document.querySelectorAll("[data-copy]").forEach((button) => {
    let timer;
    button.addEventListener("click", async () => {
      try {
        await copyText(button.dataset.copy);
        button.classList.add("copied");
        announce(t.copied);
        clearTimeout(timer);
        timer = setTimeout(() => button.classList.remove("copied"), 1600);
      } catch {
        announce(t.copyFailed);
      }
    });
  });

  /* Latest release: version, direct DMG link and size. The page ships with the
     release current at build time, so this only ever moves it forward. */
  const REPO = "ddhjy/ref-releases";
  const CACHE_KEY = "ref.release";
  const CACHE_TTL = 60 * 60 * 1000;
  const formatSize = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
  const applyRelease = (release) => {
    const tag = release.tag_name;
    if (!/^v\d+\.\d+\.\d+$/.test(tag)) return;
    const dmg = (release.assets || []).find((a) => /^Ref-\d+\.\d+\.\d+\.dmg$/.test(a.name));
    document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = tag; });
    document.querySelectorAll("[data-release-link]").forEach((el) => { if (release.html_url) el.href = release.html_url; });
    if (!dmg) return;
    document.querySelectorAll("[data-download-dmg]").forEach((el) => { el.href = dmg.browser_download_url; });
    document.querySelectorAll("[data-dmg-name]").forEach((el) => { el.textContent = dmg.name; });
    document.querySelectorAll("[data-dmg-size]").forEach((el) => { el.textContent = formatSize(dmg.size); });
  };
  const loadRelease = async () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.at < CACHE_TTL) { applyRelease(cached.release); return; }
    } catch { /* ignore a bad cache */ }
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) return;
      const release = await res.json();
      applyRelease(release);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release })); } catch { /* storage full or disabled */ }
    } catch { /* offline: the shipped links still work */ }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(loadRelease, { timeout: 2000 }); else setTimeout(loadRelease, 300);

  /* The hero output: marks and legend lines appear in the order they were placed,
     once, when the figure comes into view. */
  const demo = document.querySelector(".demo");
  if (demo && !reduceMotion.matches && "IntersectionObserver" in window) {
    demo.classList.add("animate");
    const start = () => {
      demo.classList.add("play");
      observer.disconnect();
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) start();
    }, { threshold: 0.35 });
    observer.observe(demo);
    // If the figure is already in view before fonts settle, still start soon.
    setTimeout(() => { if (!demo.classList.contains("play")) { const r = demo.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) start(); } }, 1200);
    reduceMotion.addEventListener("change", (e) => { if (e.matches) demo.classList.remove("animate"); });
  }

  /* Legend anatomy: pointing at a note lights the matching line. */
  const notes = document.querySelectorAll(".anatomy-notes li[data-for]");
  const lines = document.querySelectorAll(".anatomy-legend .hl[data-hl]");
  if (notes.length && lines.length) {
    const set = (id) => {
      lines.forEach((l) => l.classList.toggle("active", l.dataset.hl === id));
      notes.forEach((n) => n.classList.toggle("active", n.dataset.for === id));
    };
    notes.forEach((n) => {
      n.addEventListener("mouseenter", () => set(n.dataset.for));
      n.addEventListener("mouseleave", () => set(null));
    });
    lines.forEach((l) => {
      l.addEventListener("mouseenter", () => set(l.dataset.hl));
      l.addEventListener("mouseleave", () => set(null));
    });
  }
})();
