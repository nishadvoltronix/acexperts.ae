import fs from 'node:fs';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:800,height:650},deviceScaleFactor:1});
const {entries}=JSON.parse(fs.readFileSync('docs/brand-quality-prompts-remaining.json'));
for(const entry of entries){
  const name=entry.sourceLocalPath.split('/').pop().replace('.png','');
  const height=740*entry.oldHeight/entry.oldWidth;
  const extra=740*entry.height/entry.width-height;
  await page.setContent(`<html><body style="margin:20px;background:white;font:16px Arial"><p>Original: ${name}</p><div style="width:740px;height:${height}px;overflow:hidden"><img src="http://localhost:3001${entry.sourceLocalPath}" style="display:block;width:740px;height:auto"></div><p>Restored (original canvas proportions):</p><div style="width:740px;height:${height}px;overflow:hidden"><img src="http://localhost:3001${entry.replacementLocalPath}" style="display:block;width:740px;height:auto;transform:translateY(${-extra/2}px)"></div></body></html>`);
  await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  await page.screenshot({path:`docs/brand-compare-${name}.png`});
}
await browser.close();
