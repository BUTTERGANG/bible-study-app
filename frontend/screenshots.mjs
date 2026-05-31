import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'http://localhost:5000';
const OUT = '/tmp/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/home/runner/workspace/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function shot(page, name) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
}

// Desktop
const deskCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const desk = await deskCtx.newPage();

// Capture console errors
const errors = [];
desk.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
desk.on('pageerror', e => errors.push(e.message));

await desk.goto(BASE, { waitUntil: 'networkidle' });
await shot(desk, '01_desktop_home');

// Click a few tabs
for (const [tab, label] of [['insights','Insights'],['ai','AI Study'],['notes','Notes'],['groups','Groups'],['doctrine','Doctrine']]) {
  try {
    await desk.click(`button:has-text("${label}")`);
    await shot(desk, `02_desktop_${tab}`);
  } catch(e) { console.log(`  skip ${label}: ${e.message.slice(0,60)}`); }
}

// Mobile
const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' });
const mob = await mobCtx.newPage();
mob.on('console', m => { if (m.type() === 'error') errors.push('[mobile] ' + m.text()); });
mob.on('pageerror', e => errors.push('[mobile] ' + e.message));

await mob.goto(BASE, { waitUntil: 'networkidle' });
await shot(mob, '03_mobile_home');
await mob.screenshot({ path: `${OUT}/03_mobile_home_full.png`, fullPage: true });

// Scroll down to see bottom nav on mobile
await mob.evaluate(() => window.scrollTo(0, 300));
await shot(mob, '04_mobile_scrolled');

console.log('\n=== CONSOLE ERRORS ===');
if (errors.length === 0) console.log('None');
else errors.forEach(e => console.log(' •', e));

await browser.close();
