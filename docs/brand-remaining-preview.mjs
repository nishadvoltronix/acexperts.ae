import fs from 'node:fs';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:900,height:500},deviceScaleFactor:1});
const entries=JSON.parse(fs.readFileSync('artifacts/image-quality-inputs/brand-restore-list.json')).slice(16);
for(const entry of entries){
  const name=entry.sourceLocalPath.split('/').pop().replace('.png','');
  await page.setContent(`<html><body style="margin:0;background:white;display:grid;place-items:center;height:500px"><img src="http://localhost:3001${entry.sourceLocalPath}" style="width:740px;height:auto"></body></html>`);
  await page.locator('img').evaluate(image=>image.decode());
  await page.locator('img').screenshot({path:`docs/brand-source-white-${name}.png`});
}
await browser.close();
