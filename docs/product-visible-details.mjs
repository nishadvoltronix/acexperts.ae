import fs from 'node:fs';
import sharp from 'sharp';
import { chromium } from 'playwright';
const entries = JSON.parse(fs.readFileSync('docs/product-quality-prompts.json'));
const browser = await chromium.launch({channel:'chrome',headless:true});
const reports = [];
for (const width of [1440,390]) {
  const page = await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:2});
  await page.goto('http://localhost:3001/products/',{waitUntil:'networkidle'});
  await page.addStyleTag({content:'nextjs-portal{display:none}'});
  await page.evaluate(async()=>{for(const im of document.images)im.loading='eager';await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));});
  for(const entry of entries){
    const image = page.locator(`img[src*="${entry.replacementLocalPath.split('/').pop()}"]`).first();
    const detail = await image.evaluate(im=>({src:im.currentSrc,width:im.getBoundingClientRect().width,height:im.getBoundingClientRect().height,complete:im.complete}));
    const response = await fetch(detail.src);
    const bytes = Buffer.from(await response.arrayBuffer());
    const decoded = await sharp(bytes).metadata();
    await image.screenshot({path:`docs/visible-product-${entry.id}-${width}.png`,animations:'disabled'});
    reports.push({id:entry.id,viewport:width,...detail,deliveredWidth:decoded.width,deliveredHeight:decoded.height,status:response.status});
  }
  await page.close();
}
await browser.close();
fs.writeFileSync('docs/product-visible-details.json',JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
