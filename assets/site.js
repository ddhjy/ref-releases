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
    window.matchMedia("(min-width: 1121px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
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

  /* The hero shows the image that was copied; its button plays the capture that made
     it — hotkey, picks, the panel filling in, ⌘↩ — and ends back on the image. The requests come from the
     legend in the page and the geometry from the marks, so both stay the single source. */
  const demo = document.querySelector(".demo");
  const screen = demo && demo.querySelector(".demo-screen");
  if (screen && !reduceMotion.matches && "IntersectionObserver" in window) {
    const d = zh
      ? {
        hotkey: "⇧⌘R", request: "要求", typeText: "输入文字", overall: "整体要求", whole: "当前屏幕", cancel: "取消", copy: "复制",
        toast: "已复制 · 5 处标注", result: "标注效果", play: "看过程",
        hints: { frame: "点击元素或拖出区域 · 滚动切换父/子及被遮挡的元素", arrow: "拖动画出箭头", text: "点击要放文字的位置" },
        rows: ["选框 · AXTextField “components” · ~/Projects/ledger/src/components · 访达", "选框 · AXButton “新建发票”", "区域", "箭头", "文字"],
        cardHint: "按住空格可复制",
        cards: [
          ["AXTextField", [["名称", "components"], ["路径", "/Users/kai/Projects/ledger/src/components", 1], ["尺寸", "82×21 pt", 1], ["应用", "com.apple.finder", 1]]],
          ["AXButton", [["名称", "新建发票"], ["组件", "Toolbar", 1], ["源码", "src/components/Toolbar.tsx:18", 1], ["选择器", "button.primary", 1], ["尺寸", "112×32", 1],
            ["字体", "13px Inter 600", 1], ["颜色", "#FFFFFF", 1], ["背景", "#0D44E8", 1], ["页面", "http://localhost:3100/invoices", 1], ["应用", "com.apple.Safari", 1]]],
        ],
      }
      : {
        hotkey: "⇧⌘R", request: "Request", typeText: "Type text", overall: "Overall request", whole: "Whole capture", cancel: "Cancel", copy: "Copy",
        toast: "Copied · 5 annotations", result: "The result", play: "Watch it made",
        hints: { frame: "Click an element or drag a region · Scroll for parent/child and covered elements", arrow: "Drag to draw an arrow", text: "Click where the text should go" },
        rows: ["Framed element · AXTextField “components” · ~/Projects/ledger/src/components · Finder", "Framed element · AXButton “New invoice”", "Region", "Arrow", "Text"],
        cardHint: "Hold Space to copy",
        cards: [
          ["AXTextField", [["Name", "components"], ["Path", "/Users/kai/Projects/ledger/src/components", 1], ["Size", "82×21 pt", 1], ["App", "com.apple.finder", 1]]],
          ["AXButton", [["Name", "New invoice"], ["Component", "Toolbar", 1], ["Source", "src/components/Toolbar.tsx:18", 1], ["Selector", "button.primary", 1], ["Size", "124×32", 1],
            ["Font", "13px Inter 600", 1], ["Color", "#FFFFFF", 1], ["Background", "#0D44E8", 1], ["Page", "http://localhost:3100/invoices", 1], ["App", "com.apple.Safari", 1]]],
        ],
      };

    const frame = demo.querySelector(".demo-frame");
    const el = (tag, cls, html) => { const n = document.createElement(tag); n.className = cls; if (html != null) n.innerHTML = html; return n; };
    const pct = (node, name) => parseFloat(node.style.getPropertyValue(name));

    /* The requests, as the legend already states them. */
    const line = (n) => demo.querySelector(`.ll[data-n="${n}"]`);
    const note = (n) => line(n).textContent.split("\n")[0].replace(/^[^①-⑨]*[①-⑨]\s*/, "");
    const intent = line(0).textContent.slice(line(0).querySelector("em").textContent.length);

    const m1 = screen.querySelector('.mk-frame[data-n="1"]');
    const m2 = screen.querySelector('.mk-frame[data-n="2"]');
    const m3 = screen.querySelector(".mk-region");
    const arrow = screen.querySelector(".mk-arrow");
    const arrowPath = arrow.querySelector(":scope > path");
    const m4 = screen.querySelector(".mk-badge-only");
    const m5 = screen.querySelector(".mk-text");
    const marks = [m1, m2, m3, arrow, m4, m5];
    const label = m5.lastChild;
    const final = { w: m3.style.getPropertyValue("--w"), h: m3.style.getPropertyValue("--h"), d: arrowPath.getAttribute("d"), label: label.textContent };
    const view = arrow.viewBox.baseVal;
    const tail = arrow.dataset.tail.split(" ").map(Number);
    const head = arrow.dataset.head.split(" ").map(Number);
    /* MarkerGeometry.arrowPath: a straight shaft and a V head of the same weight, the tip
       pulled back half a line so the round cap lands on the head. Units are the viewBox's. */
    const arrowD = (to) => {
      const width = 8 * (view.width / 1280);
      const dx = to[0] - tail[0], dy = to[1] - tail[1], length = Math.hypot(dx, dy);
      if (length <= 1) return "";
      const ux = dx / length, uy = dy / length;
      const tip = [to[0] - ux * width / 2, to[1] - uy * width / 2];
      const arm = Math.min(width * 3, length * 0.45), bx = -ux * arm, by = -uy * arm, c = Math.SQRT1_2;
      const f = (p) => p.map((v) => +v.toFixed(2)).join(" ");
      return `M${f(tail)} L${f(tip)} M${f([tip[0] + (bx - by) * c, tip[1] + (bx + by) * c])} L${f(tip)} L${f([tip[0] + (bx + by) * c, tip[1] + (by - bx) * c])}`;
    };

    /* Everything that only exists while capturing. */
    const icon = (path, filled) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${path}" ${filled ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'}/></svg>`;
    const field = (placeholder) => `<span class="d-field"><span class="d-val"></span><i class="d-caret"></i><span class="d-ph">${placeholder}</span><span class="d-tab">Tab</span></span>`;
    const ui = el("div", "d-ui");
    const card = el("div", "d-card");
    const keys = el("span", "d-keys");
    const toast = el("span", "d-toast", `<i></i>${d.toast}`);
const cursor = el("span", "d-cursor", '<svg viewBox="0 0 23 23" aria-hidden="true"><path d="M11.5 1v21M1 11.5h21" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="square"/><path d="M11.5 1v21M1 11.5h21" fill="none" stroke="#000" stroke-width="1"/></svg>');
    const canvasCaret = el("i", "d-caret");
    const panel = el("div", "d-panel");
    const rows = el("div", "d-rows");
    const slot = el("div", "d-row d-slot", '<b class="d-n">1</b><span class="d-hint"></span>');
    const whole = el("div", "d-row d-whole", `<i class="d-win"></i><span class="d-desc">${d.whole}</span>${field(d.overall)}`);
    const bar = el("div", "d-bar",
      `<span class="d-tools"><span class="d-tool" data-tool="frame">${icon("M3.4 1.8l9.4 5.4-4 1.1 2.4 4.3-1.9 1.1-2.4-4.3-3 2.9z", true)}</span>`
      + `<span class="d-tool" data-tool="arrow">${icon("M12.5 3.5l-9 9m0-6.2v6.2h6.2")}</span>`
      + `<span class="d-tool" data-tool="text">${icon("M3.5 13L8 3l4.5 10M5.3 9.4h5.4")}</span></span>`
      + `<span class="d-tool undo dim">${icon("M6 3.5L3 6.5l3 3M3 6.5h6.5a3.25 3.25 0 010 6.5H7")}</span>`
      + `<span class="d-tool dim">${icon("M10 3.5l3 3-3 3M13 6.5H6.5a3.25 3.25 0 000 6.5H9")}</span>`
      + `<span class="d-btn first">${d.cancel}</span><span class="d-btn">ChatGPT<i class="d-sep"></i><i class="d-chev"></i></span><span class="d-btn primary">${d.copy}</span>`);
    const copyButton = bar.querySelector(".primary");
    panel.append(rows, slot, whole, bar);
    const undo = bar.querySelector(".undo");
    ui.append(card, panel, keys, toast, cursor);
    screen.append(ui);
    /* Says what the picture is, then offers to play how it was made. */
    const playButton = el("button", "demo-play", `<span>${d.result}</span><i></i><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.6 6z" fill="currentColor"/></svg>${d.play}`);
    playButton.type = "button";
    frame.append(playButton);

    /* The legend keeps its place while the capture plays: dimmed, each line lighting up as
       its mark gets its request, so nothing below the hero moves and nothing sits empty. */
    const lines = [...demo.querySelectorAll(".ll")];
    const light = (n) => line(n).classList.add("lit");
    const measure = () => demo.style.setProperty("--below", `${demo.offsetHeight - frame.offsetHeight}px`);

    const setCurrent = (row) => { panel.querySelectorAll(".cur").forEach((r) => r.classList.remove("cur")); row.classList.add("cur"); };
    const setTool = (name) => {
      bar.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === name));
      slot.querySelector(".d-hint").textContent = d.hints[name];
    };
    const addRow = (n, placeholder) => {
      const row = el("div", "d-row in", `<b class="d-n">${n}</b><span class="d-desc"></span>${field(placeholder)}`);
      row.querySelector(".d-desc").textContent = d.rows[n - 1];
      rows.append(row);
      undo.classList.remove("dim");
      slot.querySelector(".d-n").textContent = n + 1;
      setCurrent(row);
      return row.querySelector(".d-field");
    };
    const restore = () => {
      m3.style.transition = "";
      m3.style.setProperty("--w", final.w);
      m3.style.setProperty("--h", final.h);
      arrowPath.setAttribute("d", final.d);
      label.textContent = final.label;
      canvasCaret.remove();
    };
    const reset = () => {
      restore();
      marks.forEach((m) => m.classList.remove("on", "set"));
      [card, panel, keys, toast].forEach((n) => n.classList.remove("on"));
      ui.querySelectorAll(".d-ripple").forEach((n) => n.remove());
      rows.textContent = "";
      undo.classList.add("dim");
      slot.querySelector(".d-n").textContent = 1;
      const overall = whole.querySelector(".d-field");
      overall.classList.remove("focus", "has");
      overall.querySelector(".d-val").textContent = "";
      setCurrent(whole);
      setTool("frame");
      copyButton.classList.remove("down");
      cursor.classList.remove("gone");
      cursor.style.transition = "none";
      cursor.style.left = "56%";
      cursor.style.top = "58%";
      lines.forEach((l) => l.classList.remove("lit"));
      demo.classList.remove("done");
      demo.classList.add("staged");
      measure();
    };

    let run = 0;
    const play = async () => {
      const id = ++run;
      const wait = (ms) => new Promise((resolve, reject) => setTimeout(() => (id === run ? resolve() : reject(0)), ms));
      const tween = (ms, fn) => new Promise((resolve, reject) => {
        const from = performance.now();
        const tick = (now) => {
          if (id !== run) { reject(0); return; }
          const k = Math.min(1, Math.max(0, (now - from) / ms));
          fn(k);
          if (k < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      const moveTo = (x, y, ms, ease = "cubic-bezier(0.45, 0, 0.2, 1)") => {
        cursor.style.transition = `left ${ms}ms ${ease}, top ${ms}ms ${ease}, opacity 0.25s`;
        cursor.style.left = `${x}%`;
        cursor.style.top = `${y}%`;
        return wait(ms);
      };
      /* Not part of the app either: a ring where the pointer presses, so a click can be seen. */
      const ripple = () => {
        const ring = el("span", "d-ripple");
        ring.style.left = cursor.style.left;
        ring.style.top = cursor.style.top;
        ring.addEventListener("animationend", () => ring.remove());
        ui.insertBefore(ring, cursor);
      };
      const press = async (text, ms) => {
        keys.textContent = text;
        keys.classList.add("on");
        await wait(ms);
        keys.classList.remove("on");
      };
      const type = async (into, text, mirror, pace = 900) => {
        const value = into.querySelector(".d-val");
        const chars = Array.from(text);
        /* A steady hand: short requests are not rushed, long ones do not drag. */
        const each = Math.max(26, Math.min(80, pace / chars.length));
        into.classList.add("focus", "has");
        for (const c of chars) {
          value.textContent += c;
          if (mirror) mirror(value.textContent);
          into.scrollLeft = into.scrollWidth;
          await wait(each);
        }
      };
      /* The mark lands, a beat; the request is typed; then long enough to read it. */
      const write = async (into, text, mirror, rest = 650) => {
        await wait(350);
        await type(into, text, mirror);
        await wait(rest);
        into.classList.remove("focus");
        into.scrollLeft = 0;
      };

      reset();
      try {
        await wait(700);
        await press(d.hotkey, 1000);
        panel.classList.add("on");
        /* Let the panel be seen before anything moves. */
        await wait(1200);

        /* ① ② — point: the highlight is the frame itself and the card says what Ref read; click adds the badge. */
        for (const [i, m] of [m1, m2].entries()) {
          const [x, y, w, h] = ["--x", "--y", "--w", "--h"].map((name) => pct(m, name));
          await moveTo(x + w * 0.5, y + h * 0.5, i ? 750 : 650);
          const [title, fields] = d.cards[i];
          card.innerHTML = `<b><em></em><small></small></b>${fields.map(() => "<span><i></i><em></em></span>").join("")}`;
          /* The names share one column, as wide as the longest. */
          card.style.setProperty("--names", `${Math.max(...fields.map(([name]) => Array.from(name).reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 1 : 0.58), 0)))}em`);
          card.firstChild.firstChild.textContent = title;
          card.firstChild.lastChild.textContent = d.cardHint;
          fields.forEach(([name, value, code], r) => {
            const cells = card.children[r + 1].children;
            cells[0].textContent = name;
            cells[1].textContent = value;
            cells[1].classList.toggle("code", !!code);
          });
          /* Above the element, else below; kept inside the screen. */
          Object.assign(card.style, i
            ? { left: "auto", right: "calc(8 * var(--pt))", top: `calc(${y + h}% + 8 * var(--pt))`, bottom: "auto" }
            : { left: `${x}%`, right: "auto", top: "auto", bottom: `calc(${100 - y}% + 8 * var(--pt))` });
          m.classList.add("on");
          card.classList.add("on");
          /* The card is the point of hovering: hold long enough to read it, the first one longest. */
          await wait(i ? 1300 : 1700);
          ripple();
          card.classList.remove("on");
          m.classList.add("set");
          await wait(250);
          await write(addRow(i + 1, d.request), note(i + 1));
          light(i + 1);
          await wait(200);
        }

        /* ③ — drag a region out. */
        const [x3, y3] = [pct(m3, "--x"), pct(m3, "--y")];
        await moveTo(x3, y3, 550);
        await wait(200);
        ripple();
        m3.style.transition = "none";
        m3.style.setProperty("--w", "0%");
        m3.style.setProperty("--h", "0%");
        m3.classList.add("on");
        void m3.offsetWidth;
        const drag = "cubic-bezier(0.4, 0, 0.3, 1)";
        m3.style.transition = `width 850ms ${drag}, height 850ms ${drag}`;
        m3.style.setProperty("--w", final.w);
        m3.style.setProperty("--h", final.h);
        await moveTo(x3 + parseFloat(final.w), y3 + parseFloat(final.h), 850, drag);
        await wait(300);
        m3.style.transition = "";
        m3.classList.add("set");
        await write(addRow(3, d.request), note(3), null, 450);
        light(3);
        await wait(150);

        /* ④ — A, then drag an arrow: it grows from the tail, the badge lands behind it on release. */
        setTool("arrow");
        await press("A", 550);
        const toScreen = ([x, y]) => [(x / view.width) * 100, (y / view.height) * 100];
        await moveTo(...toScreen(tail), 450);
        await wait(200);
        ripple();
        cursor.style.transition = "opacity 0.25s";
        await tween(750, (t) => {
          const k = t * t * (3 - 2 * t);
          const to = [tail[0] + (head[0] - tail[0]) * k, tail[1] + (head[1] - tail[1]) * k];
          arrowPath.setAttribute("d", arrowD(to));
          arrow.classList.add("on");
          const [x, y] = toScreen(to);
          cursor.style.left = `${x}%`;
          cursor.style.top = `${y}%`;
        });
        arrowPath.setAttribute("d", final.d);
        await wait(300);
        m4.classList.add("on", "set");
        await write(addRow(4, d.request), note(4), null, 450);
        light(4);
        await wait(150);

        /* ⑤ — T, click, type: a text annotation's request is the text on the canvas. */
        setTool("text");
        await press("T", 550);
        await moveTo(pct(m5, "--x"), pct(m5, "--y"), 450);
        await wait(200);
        ripple();
        label.textContent = "";
        m5.append(canvasCaret);
        m5.classList.add("on", "set");
        /* Typed at once: its row takes the keyboard as it appears. */
        const typed = addRow(5, d.typeText);
        typed.classList.add("focus");
        await write(typed, final.label, (text) => { label.textContent = text; }, 500);
        canvasCaret.remove();
        light(5);

        /* The overall request, then ⌘↩. */
        const overall = whole.querySelector(".d-field");
        setCurrent(whole);
        await wait(500);
        /* The longest line, typed briskly; then the whole panel gets a look before ⌘↩. */
        await type(overall, intent, null, 1300);
        light(0);
        await wait(900);
        copyButton.classList.add("down");
        await press("⌘↩", 900);
        copyButton.classList.remove("down");
        overall.classList.remove("focus");
        panel.classList.remove("on");
        cursor.classList.add("gone");
        await wait(450);
        light(6);
        demo.classList.remove("staged");
        await wait(700);
        toast.classList.add("on");
        await wait(2600);
        toast.classList.remove("on");
        await wait(250);
        demo.classList.add("done");
      } catch (stopped) {
        if (stopped !== 0) throw stopped;
      }
    };

    /* At rest: the finished image, every mark placed. */
    marks.forEach((m) => m.classList.add("on", "set"));
    cursor.classList.add("gone");
    demo.classList.add("animate", "done");
    measure();
    new ResizeObserver(measure).observe(frame);
    playButton.addEventListener("click", () => {
      screen.scrollIntoView({ block: "center", behavior: "smooth" });
      play();
    });
    reduceMotion.addEventListener("change", (e) => {
      if (!e.matches) return;
      run += 1;
      restore();
      demo.classList.remove("animate", "staged", "done");
    });
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
