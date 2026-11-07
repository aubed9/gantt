// scripts/capture-prototype-screenshots.js
import puppeteer from 'puppeteer';
import path from 'path';

const artifactDir = 'C:/Users/aubed/.gemini/antigravity/brain/72e6ef1a-fe67-4660-a3d1-d7ad784d0fdc';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // 1. Variant A (Executive Cockpit)
  console.log('Capturing Variant A...');
  await page.goto('http://127.0.0.1:3122/?variant=A', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'variant_a.png'), fullPage: false });

  // 2. Variant B (Task Claim & Resource Board)
  console.log('Capturing Variant B...');
  await page.goto('http://127.0.0.1:3122/?variant=B', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'variant_b.png'), fullPage: false });

  // 3. Variant C (Milestone & EOJ Inspector)
  console.log('Capturing Variant C...');
  await page.goto('http://127.0.0.1:3122/?variant=C', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(artifactDir, 'variant_c.png'), fullPage: false });

  console.log('All screenshots captured successfully in artifact directory!');
  await browser.close();
})();
