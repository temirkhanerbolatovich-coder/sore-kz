import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
const phase = process.argv[2] ?? 'after';
const chrome = await launch({chromePath: chromium.executablePath(), chromeFlags: ['--headless', '--no-sandbox']});
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3100/demo');
const product = await page.locator('main ul li a').first().getAttribute('href');
await browser.close();
const rows = [];
await mkdir('reports', {recursive:true});
try {
  for (const profile of ['mobile', 'desktop']) for (const path of ['/', '/demo', product, '/demo/cart']) {
    const result = await lighthouse(`http://localhost:3100${path}`, { port: chrome.port, output: 'json', onlyCategories: ['performance','accessibility'], ...(profile === 'desktop' ? {formFactor: 'desktop', screenEmulation: {mobile:false,width:1440,height:900,deviceScaleFactor:1,disabled:false}} : {}) });
    const lhr = result.lhr;
    await writeFile(`reports/lighthouse-${phase}-${profile}-${rows.length}.json`, JSON.stringify(lhr));
    rows.push({profile,path,performance:lhr.categories.performance.score * 100,accessibility:lhr.categories.accessibility.score * 100,lcp:lhr.audits['largest-contentful-paint'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue});
    console.log(JSON.stringify(rows.at(-1)));
  }
  await mkdir('reports/ui-polish', {recursive:true});
  await writeFile(`reports/ui-polish/lighthouse-${phase}.json`, JSON.stringify(rows,null,2));
} finally { await chrome.kill(); }
