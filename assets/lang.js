/* Ref — the page in the visitor's language. Runs before the page is drawn, so the wrong
   language is never seen: a choice made with the footer's language links wins; otherwise the
   browser's first language decides — Chinese gets the Chinese page, anything else the English
   one. Crawlers and link previews are left where they landed, so both pages stay indexed. */
(() => {
  try {
    const here = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
    let want = localStorage.getItem("ref-lang");
    if (want !== "zh" && want !== "en") {
      if (/bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|headless/i.test(navigator.userAgent)) return;
      const first = (navigator.languages && navigator.languages[0]) || navigator.language || "";
      want = /^zh\b/i.test(first) ? "zh" : "en";
    }
    if (want !== here) location.replace((here === "zh" ? "en/" : "../") + location.search + location.hash);
  } catch (e) { /* No storage, no redirect: the page as served. */ }
})();
