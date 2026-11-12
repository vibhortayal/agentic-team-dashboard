const { chromium } = require('playwright');
(async () => {
  const port = process.argv[2], out = process.argv[3], tag = process.argv[4] || 'demo';
  const b = await chromium.launch();
  const runs = [['desktop', 1440, 900], ['phone', 390, 844]];
  for (const scheme of ['light', 'dark']) for (const [name, w, h] of runs) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`http://localhost:${port}/`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${tag}-${name}-${scheme}.png` });
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const first = await p.evaluate(() => {
      const r = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const n = w.currentNode; const e = n.parentElement; if (!n.textContent.trim()) continue;
        const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        if (b.top < innerHeight && b.bottom > 0 && cs.display !== 'none' && cs.visibility !== 'hidden') r.push(n.textContent.trim()); }
      return r.join(' | ');
    });
    const links = await p.evaluate(() => [...document.querySelectorAll('a')].filter(a=>a.offsetParent).map(a => a.href).slice(0, 6));
    console.log(JSON.stringify({ tag, name, scheme, scroll: sw, errs, links, first }));
    await ctx.close();
  }
  await b.close();
})();
