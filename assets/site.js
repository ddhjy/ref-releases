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

  /* The footer's language links are the one manual switch: lang.js keeps to the choice. */
  document.querySelectorAll(".footer-langs a").forEach((a) => {
    a.addEventListener("click", () => { try { localStorage.setItem("ref-lang", a.lang.toLowerCase().startsWith("zh") ? "zh" : "en"); } catch (e) { /* The link still works. */ } });
  });

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

  /* Not on a Mac: say so next to the download, since the DMG is of no use there. iPadOS
     Safari calls itself a Mac but has a touch screen, which a Mac never does. */
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  const isMac = /mac/i.test(platform) && !(navigator.maxTouchPoints > 1);
  if (!isMac) document.querySelectorAll("[data-not-mac]").forEach((el) => { el.hidden = false; });

  /* On a Mac whose macOS is too old for Ref: say that too. The user agent string froze at
     10.15, so only browsers that answer the high-entropy hint tell the real version;
     elsewhere the line under the download has to do. */
  const MIN_MACOS = 26;
  const oldMac = document.querySelectorAll("[data-old-macos]");
  if (isMac && oldMac.length && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(["platformVersion"]).then(({ platformVersion }) => {
      const major = parseInt(platformVersion, 10);
      if (!(major > 0 && major < MIN_MACOS)) return;
      oldMac.forEach((el) => {
        el.querySelectorAll("[data-macos-version]").forEach((v) => { v.textContent = major; });
        el.hidden = false;
      });
    }).catch(() => { /* no answer: the page's text still states the requirement */ });
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
     release current at build time, so this only ever moves it forward: the
     shipped buttons download a copy from this site, which gets through where
     GitHub does not, and stay as they are unless GitHub has something newer. */
  const REPO = "ddhjy/ref-releases";
  const CACHE_KEY = "ref.release";
  const CACHE_TTL = 60 * 60 * 1000;
  const formatSize = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
  const shippedName = document.querySelector("[data-dmg-name]");
  const shipped = ((shippedName && shippedName.textContent.match(/\d+\.\d+\.\d+/)) || [""])[0];
  const applyRelease = (release) => {
    const tag = release.tag_name;
    if (!/^v\d+\.\d+\.\d+$/.test(tag)) return;
    if (shipped && tag.slice(1).localeCompare(shipped, undefined, { numeric: true }) <= 0) return;
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
        hotkey: "⌥⌘R", request: "要求", typeText: "输入文字", overall: "整体要求", whole: "当前屏幕", cancel: "取消", copy: "复制",
        toast: "已复制 · 6 处标注", play: "标注演示", length: "0:38", wheel: "滚轮", skip: "跳过",
        hints: { frame: "点击元素或拖出区域 · 滚动切换父/子及被遮挡的元素", arrow: "点击要指的位置，或拖动画出箭头", text: "点击要放文字的位置" },
        textRole: "文本",
        rows: ["选框 · 输入框 “components” · ~/Projects/ledger/src/components · 访达", "选框 · 按钮 “新建发票”", "选框 · UIButton “新建” · 模拟器", "区域", "箭头", "文字"],
        cardHint: "按住空格可复制",
        cards: [
          ["输入框", [["名称", "components"], ["路径", "/Users/kai/Projects/ledger/src/components", 1], ["尺寸", "82×21 pt", 1], ["应用", "com.apple.finder", 1]]],
          ["按钮", [["名称", "新建发票"], ["组件", "Toolbar", 1], ["源码", "src/components/Toolbar.tsx:18", 1], ["选择器", "button.primary", 1], ["尺寸", "112×32", 1],
            ["字体", "13px Inter 600", 1], ["颜色", "#FFFFFF", 1], ["背景", "#0D44E8", 1], ["页面", "http://localhost:3100/invoices", 1], ["应用", "com.apple.Safari", 1]]],
          ["UIButton", [["名称", "新建"], ["类", "PillButton", 1], ["属性", "InvoiceListViewController.addButton", 1], ["Frame", "(296, 62) 80×44 pt", 1],
            ["字体", "17pt SFProText-Semibold", 1], ["颜色", "#FFFFFF", 1], ["背景", "#0D44E8", 1], ["圆角", "22", 1], ["设备", "iPhone 17 Pro"], ["应用", "com.apple.iphonesimulator", 1]]],
        ],
      }
      : {
        hotkey: "⌥⌘R", request: "Request", typeText: "Type text", overall: "Overall request", whole: "Whole capture", cancel: "Cancel", copy: "Copy",
        toast: "Copied · 6 annotations", play: "Watch the demo", length: "0:40", wheel: "Scroll", skip: "Skip",
        hints: { frame: "Click an element or drag a region · Scroll for parent/child and covered elements", arrow: "Click where the arrow should point, or drag to draw one", text: "Click where the text should go" },
        textRole: "Text",
        rows: ["Framed element · text field “components” · ~/Projects/ledger/src/components · Finder", "Framed element · button “New invoice”", "Framed element · UIButton “New” · Simulator", "Region", "Arrow", "Text"],
        cardHint: "Hold Space to copy",
        cards: [
          ["Text field", [["Name", "components"], ["Path", "/Users/kai/Projects/ledger/src/components", 1], ["Size", "82×21 pt", 1], ["App", "com.apple.finder", 1]]],
          ["Button", [["Name", "New invoice"], ["Component", "Toolbar", 1], ["Source", "src/components/Toolbar.tsx:18", 1], ["Selector", "button.primary", 1], ["Size", "124×32", 1],
            ["Font", "13px Inter 600", 1], ["Color", "#FFFFFF", 1], ["Background", "#0D44E8", 1], ["Page", "http://localhost:3100/invoices", 1], ["App", "com.apple.Safari", 1]]],
          ["UIButton", [["Name", "New"], ["Class", "PillButton", 1], ["Property", "InvoiceListViewController.addButton", 1], ["Frame", "(296, 62) 80×44 pt", 1],
            ["Font", "17pt SFProText-Semibold", 1], ["Color", "#FFFFFF", 1], ["Background", "#0D44E8", 1], ["Corner radius", "22", 1], ["Device", "iPhone 17 Pro"], ["App", "com.apple.iphonesimulator", 1]]],
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
    const mSim = screen.querySelector('.mk-frame[data-n="3"]');
    const m3 = screen.querySelector(".mk-region");
    const arrow = screen.querySelector(".mk-arrow");
    const arrowPath = arrow.querySelector(":scope > path");
    const m4 = screen.querySelector(".mk-badge-only");
    const m5 = screen.querySelector(".mk-text");
    const marks = [m1, m2, mSim, m3, arrow, m4, m5];
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
    const map = el("div", "d-map");
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
    ui.append(card, map, panel, keys, toast, cursor);
    screen.append(ui);
    /* The one control on the picture, offered the way a video's poster offers itself: a play
       disc, what it plays, and how long the run below takes — d.length, which differs by
       language because the typing does. */
    const playButton = el("button", "demo-play", `<i><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.6 6z" fill="currentColor"/></svg></i>${d.play}<small aria-hidden="true">${d.length}</small>`);
    playButton.type = "button";
    /* The shutter at ⌘↩: a white flash over the whole frame, the way the screen flashes for a screenshot. */
    const flash = el("i", "d-flash");
    flash.addEventListener("animationend", () => flash.classList.remove("on"));
    frame.append(playButton, flash);

    const sides = ["--x", "--y", "--w", "--h"];
    const home = sides.map((name) => m2.style.getPropertyValue(name));
    const showCard = (title, fields) => {
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
    };
    /* Under the element and against the screen's right edge, where ② and what holds it both end. */
    const cardBelow = ([, y, , h]) => Object.assign(card.style, { left: "auto", right: "calc(8 * var(--pt))", top: `calc(${y + h}% + 8 * var(--pt))`, bottom: "auto" });

    /* What lies under the pointer at ②, outermost first: the button and the words on it. The
       pointer lands on the words, so that is what the highlight takes; the wheel goes out to the
       button. Boxes are [x, y, w, h] in percent of the screen, the words' read off the picture. */
    const layers = () => {
      const all = screen.getBoundingClientRect();
      const words = document.createRange();
      words.selectNodeContents(screen.querySelector('[data-mark="2"]'));
      const r = words.getBoundingClientRect();
      const text = [(r.left - all.left) / all.width * 100, (r.top - all.top) / all.height * 100, r.width / all.width * 100, r.height / all.height * 100];
      const [title, fields] = d.cards[1];
      const button = home.map(parseFloat);
      /* The words in the page's own pixels, at the scale the button's size gives. */
      const [bw, bh] = fields[4][1].split("×").map(Number);
      const size = `${Math.round(text[2] / button[2] * bw)}×${Math.round(text[3] / button[3] * bh)}`;
      /* The map names every layer; the card heads plain text by what it says. */
      return [{ role: title, title, name: fields[0][1], box: button, fields },
        { role: d.textRole, title: fields[0][1], name: fields[0][1], box: text, fields: [fields[0], [fields[4][0], size, 1], fields[8], fields[9]] }];
    };
    /* LayerMap: a wireframe of the elements to scale over one row each, indented by nesting,
       the pointer's own hit marked with its glyph. */
    const buildMap = (stack, [px, py]) => {
      const [ex, ey, ew, eh] = stack[0].box;
      map.innerHTML = `<div class="d-wire"><div class="d-wire-in" style="--ar:${(ew * 14.4) / (eh * 9)}">`
        + stack.map(({ box: [x, y, w, h] }) => `<i class="d-box" style="left:${(x - ex) / ew * 100}%;top:${(y - ey) / eh * 100}%;width:${w / ew * 100}%;height:${h / eh * 100}%"></i>`).join("")
        + `<i class="d-cross" style="left:${(px - ex) / ew * 100}%;top:${(py - ey) / eh * 100}%"></i></div></div>`
        + stack.map((layer, depth) => `<div class="d-lrow" style="--depth:${depth}">${layer.role}${layer.name ? `<em>${layer.name}</em>` : ""}`
          + `${depth === stack.length - 1 ? icon("M3.4 1.8l9.4 5.4-4 1.1 2.4 4.3-1.9 1.1-2.4-4.3-3 2.9z", true) : ""}</div>`).join("");
      /* Left of the pointer — ② sits at the screen's right edge — the hit's row, the last, level with it. */
      Object.assign(map.style, { right: `calc(${100 - px}% + 16 * var(--pt))`, bottom: `calc(${100 - py}% - 15 * var(--pt))` });
    };
    /* The selection moves: the map's row and box, the highlight on the canvas, the card. */
    const select = (stack, k) => {
      map.querySelectorAll(".d-lrow").forEach((r, i) => r.classList.toggle("cur", i === k));
      map.querySelectorAll(".d-box").forEach((b, i) => { b.classList.toggle("cur", i === k); b.classList.toggle("hold", i === k - 1); });
      sides.forEach((name, i) => m2.style.setProperty(name, `${stack[k].box[i]}%`));
      showCard(stack[k].title, stack[k].fields);
      cardBelow(stack[k].box);
    };

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
      sides.forEach((name, i) => m2.style.setProperty(name, home[i]));
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
      [card, map, panel, keys, toast].forEach((n) => n.classList.remove("on"));
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

    /* At rest: the finished image, every mark placed, the legend in full. */
    const finish = () => {
      restore();
      marks.forEach((m) => m.classList.add("on", "set"));
      [card, map, panel, keys, toast, flash].forEach((n) => n.classList.remove("on"));
      ui.querySelectorAll(".d-ripple").forEach((n) => n.remove());
      copyButton.classList.remove("down");
      cursor.classList.add("gone");
      lines.forEach((l) => l.classList.remove("lit"));
      demo.classList.remove("staged", "rewind");
    };

    /* The frame plays off the page: it comes forward to the middle of the window, scaled so the
       whole image — screen and legend — stays in view while the legend fills in, with the page
       dimmed and held still behind it. ⌘↩ flashes it like a screenshot, and the finished image
       settles back into its place: what was copied is what the page shows. Esc, a click anywhere
       or the Skip pill in the window's corner ends it early — lifted, the frame leaves little
       of the page to click on. */
    const html = document.documentElement;
    const scrim = el("div", "demo-scrim");
    scrim.setAttribute("aria-hidden", "true");
    const skipButton = el("button", "demo-skip", `${d.skip}<kbd>Esc</kbd>`);
    skipButton.type = "button";
    skipButton.setAttribute("aria-label", d.skip);
    document.body.append(scrim, skipButton);
    const stay = (e) => e.preventDefault();
    let locked = false, bodyPad = "";
    const lock = () => {
      if (locked) return;
      locked = true;
      /* Where the scrollbar takes room, keep that room so the page does not shift. */
      const bar = window.innerWidth - html.clientWidth;
      bodyPad = document.body.style.paddingRight;
      if (bar > 0) document.body.style.paddingRight = `${bar}px`;
      html.classList.add("demo-lock");
      document.addEventListener("touchmove", stay, { passive: false });
    };
    const unlock = () => {
      if (!locked) return;
      locked = false;
      html.classList.remove("demo-lock");
      document.body.style.paddingRight = bodyPad;
      document.removeEventListener("touchmove", stay);
    };
    /* From where it lies to the middle of the window, as large as fits inside a margin. The
       figure itself never moves, so its box gives the frame's resting place. */
    const lift = () => {
      const at = demo.getBoundingClientRect();
      const w = frame.offsetWidth, h = frame.offsetHeight;
      const vw = html.clientWidth, vh = window.innerHeight;
      const pad = Math.max(8, Math.min(24, Math.min(vw, vh) * 0.03));
      const s = Math.min((vw - 2 * pad) / w, (vh - 2 * pad) / h, 2);
      const x = vw / 2 - (at.left + w / 2), y = vh / 2 - (at.top + h / 2);
      demo.style.setProperty("--lift", `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`);
    };
    /* rest → lifting → playing → settling → rest. Every step of a run checks it is still the
       current one, so a new run — or a stop — cuts it short. */
    let phase = "rest";
    let run = 0;
    const settle = async () => {
      phase = "settling";
      removeEventListener("resize", lift);
      if (demo.classList.contains("up")) {
        demo.style.setProperty("--lift", "translate(0px, 0px) scale(1)");
        scrim.classList.remove("on");
        await new Promise((resolve) => setTimeout(resolve, 800));
        demo.classList.remove("up");
        demo.style.removeProperty("--lift");
      }
      unlock();
      phase = "rest";
      demo.classList.add("done");
    };
    const land = () => { finish(); return settle(); };
    const stop = () => {
      if (phase !== "lifting" && phase !== "playing") return;
      run += 1;
      land();
    };
    scrim.addEventListener("click", stop);
    skipButton.addEventListener("click", stop);
    /* At rest the whole screen is the play button's target, the way a click anywhere on a
       video's poster plays it; once a run has begun, a click anywhere on the frame ends it. The
       play button's own click passes through here too and is left to its own listener. */
    frame.addEventListener("click", (e) => {
      if (e.target.closest(".demo-play")) return;
      if (phase !== "rest") stop(); else if (screen.contains(e.target)) play();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") stop(); });
    /* The button answers the pointer being over the screen. The page can come to lie under a
       pointer that has not moved — a wheel scroll — and :hover does not notice that, so the
       pointer's last place is kept and looked up again on every scroll. */
    let at = null, looking = false;
    const look = () => {
      looking = false;
      const under = at && document.elementFromPoint(at.x, at.y);
      demo.classList.toggle("over", !!under && (screen.contains(under) || playButton.contains(under)));
    };
    const lookSoon = () => { if (!looking) { looking = true; requestAnimationFrame(look); } };
    addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { at = { x: e.clientX, y: e.clientY }; lookSoon(); } }, { passive: true });
    addEventListener("scroll", lookSoon, { passive: true });
    html.addEventListener("pointerleave", () => { at = null; lookSoon(); });

    const play = async () => {
      if (phase === "settling") return;
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
      /* If the screen's middle is off the window — the quick-start link is a screen below — the
         page first scrolls it to the middle, so the lift starts from, and lands on, something in view. */
      const bring = async () => {
        const vh = window.innerHeight;
        const r = screen.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if (mid > (header ? header.offsetHeight : 0) && mid < vh) return;
        const from = window.scrollY;
        const to = Math.max(0, Math.min(html.scrollHeight - vh, from + mid - vh / 2));
        const was = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto";
        try {
          await tween(Math.min(650, 250 + Math.abs(to - from) / 6), (k) => { window.scrollTo(0, from + (to - from) * (1 - (1 - k) ** 3)); });
        } finally {
          html.style.scrollBehavior = was;
        }
      };
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

      try {
        if (phase === "rest") {
          phase = "lifting";
          demo.classList.remove("done");
          await bring();
          lock();
          lift();
          demo.classList.add("up");
          scrim.classList.add("on");
          addEventListener("resize", lift);
          await wait(1000);
          /* In place: back to the moment before the hotkey — the marks lift off, the legend dims. */
          demo.classList.add("rewind");
          reset();
          await wait(450);
          demo.classList.remove("rewind");
        } else {
          /* Already up: again from the top. */
          reset();
        }
        phase = "playing";
        await wait(700);
        await press(d.hotkey, 1000);
        panel.classList.add("on");
        /* Let the panel be seen before anything moves. */
        await wait(1200);

        /* ① ② ③ — point: the highlight is the frame itself and the card says what Ref read; click adds the badge. */
        for (const [i, m] of [m1, m2, mSim].entries()) {
          const [x, y, w, h] = ["--x", "--y", "--w", "--h"].map((name) => pct(m, name));
          const at = [x + w * 0.5, y + h * 0.5];
          await moveTo(...at, i ? 750 : 650);
          /* ② is pointed at in its middle, on the words: the highlight takes those, not the button. */
          const stack = i === 1 ? layers() : null;
          if (stack) select(stack, 1);
          else {
            showCard(...d.cards[i]);
            /* Above the element; kept inside the screen. */
            Object.assign(card.style, { left: `${x}%`, right: "auto", top: "auto", bottom: `calc(${100 - y}% + 8 * var(--pt))` });
          }
          m.classList.add("on");
          card.classList.add("on");
          /* The card is the point of hovering: hold long enough to read it. ① is nothing but
             point and click, so the first thing seen is how fast a pick is. */
          await wait(i ? 1300 : 1100);
          if (stack) {
            /* What the wheel is for, once a plain pick has been seen: the card says the highlight
               has only the words. The first notch brings up the map, the next goes out to the
               button, and the card fills with what the button carries — its component and source. */
            buildMap(stack, at);
            select(stack, 1);
            keys.textContent = `${d.wheel} ↑`;
            keys.classList.add("on");
            map.classList.add("on");
            await wait(800);
            select(stack, 0);
            await wait(1700);
            keys.classList.remove("on");
            map.classList.remove("on");
            await wait(450);
          }
          ripple();
          card.classList.remove("on");
          m.classList.add("set");
          await wait(250);
          await write(addRow(i + 1, d.request), note(i + 1));
          light(i + 1);
          await wait(200);
        }

        /* ④ — drag a region out. */
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
        await write(addRow(4, d.request), note(4), null, 450);
        light(4);
        await wait(150);

        /* ⑤ — A, then drag an arrow: it grows from the tail, the badge lands behind it on release. */
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
        await write(addRow(5, d.request), note(5), null, 450);
        light(5);
        await wait(150);

        /* ⑥ — T, click, type: a text annotation's request is the text on the canvas. */
        setTool("text");
        await press("T", 550);
        await moveTo(pct(m5, "--x"), pct(m5, "--y"), 450);
        await wait(200);
        ripple();
        label.textContent = "";
        m5.append(canvasCaret);
        m5.classList.add("on", "set");
        /* Typed at once: its row takes the keyboard as it appears. */
        const typed = addRow(6, d.typeText);
        typed.classList.add("focus");
        await write(typed, final.label, (text) => { label.textContent = text; }, 500);
        canvasCaret.remove();
        light(6);

        /* The overall request, then ⌘↩. */
        const overall = whole.querySelector(".d-field");
        setCurrent(whole);
        await wait(500);
        /* The longest line, typed briskly; then the whole panel gets a look before ⌘↩. */
        await type(overall, intent, null, 1300);
        light(0);
        await wait(900);
        copyButton.classList.add("down");
        keys.textContent = "⌘↩";
        keys.classList.add("on");
        await wait(300);
        /* The shutter: under the flash the overlay goes and the legend is drawn in full, so what
           the flash leaves behind is the image. */
        flash.classList.remove("on");
        void flash.offsetWidth;
        flash.classList.add("on");
        await wait(90);
        copyButton.classList.remove("down");
        keys.classList.remove("on");
        overall.classList.remove("focus");
        panel.classList.remove("on");
        cursor.classList.add("gone");
        light(7);
        demo.classList.remove("staged");
        await wait(1000);
        toast.classList.add("on");
        await wait(1900);
        toast.classList.remove("on");
        await wait(300);
        /* Copied: the image goes back down into the page, where it was all along. */
        await land();
      } catch (stopped) {
        if (stopped !== 0) throw stopped;
      }
    };

    finish();
    demo.classList.add("animate", "done");
    measure();
    new ResizeObserver(measure).observe(frame);
    playButton.addEventListener("click", play);
    reduceMotion.addEventListener("change", (e) => {
      if (!e.matches) return;
      run += 1;
      phase = "rest";
      removeEventListener("resize", lift);
      restore();
      demo.classList.remove("animate", "staged", "done", "up", "rewind", "over");
      demo.style.removeProperty("--lift");
      scrim.classList.remove("on");
      unlock();
    });
  }

  /* A link into a folded block — the shortcuts under “More” — opens it on the way. */
  const unfold = (id) => {
    for (let node = id && document.getElementById(id); node; node = node.parentElement) {
      if (node.tagName === "DETAILS") node.open = true;
    }
  };
  const unfoldHash = () => unfold(decodeURIComponent(location.hash.slice(1)));
  unfoldHash();
  addEventListener("hashchange", unfoldHash);
  /* In-page links: the block is opened first, then the page goes there in a fixed, short time
     however far it is — the browser's own smooth scroll takes over a second across the page.
     With reduced motion it simply arrives. */
  let glide = 0;
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute("href").slice(1));
    unfold(id);
    const target = id && document.getElementById(id);
    if (!target || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const root = document.documentElement;
    const from = window.scrollY;
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const to = Math.max(0, Math.min(root.scrollHeight - window.innerHeight, from + target.getBoundingClientRect().top - pad));
    if (location.hash !== `#${id}`) history.pushState(null, "", `#${id}`);
    const run = ++glide;
    const start = performance.now();
    const ms = reduceMotion.matches ? 0 : 280;
    const step = (now) => {
      if (run !== glide) return;
      const k = ms ? Math.min(1, (now - start) / ms) : 1;
      window.scrollTo(0, from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  /* The visitor's own scrolling takes over at once. */
  ["wheel", "touchstart", "keydown"].forEach((type) => addEventListener(type, () => { glide += 1; }, { passive: true }));
})();
