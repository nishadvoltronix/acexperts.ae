import fs from 'node:fs';
import { chromium } from 'playwright';
const {entries}=JSON.parse(fs.readFileSync('docs/brand-quality-prompts-remaining.json'));
const targets=Object.fromEntries(entries.map(entry=>[entry.replacementLocalPath,entry]));
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const route of ['/about/','/products/','/services/'])for(const width of [390,768]){
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:2});
  await page.goto('http://localhost:3001'+route,{waitUntil:'networkidle'});
  await page.addStyleTag({content:'nextjs-portal{display:none}'});
  await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
  const images=await page.evaluate(()=>[...document.images].map((img,index)=>{const u=new URL(img.currentSrc||img.src,location.href);const r=img.getBoundingClientRect();const s=getComputedStyle(img);return {index,assetPath:u.pathname.startsWith('/_next/image')?u.searchParams.get('url'):u.pathname,alt:img.alt,width:r.width,height:r.height,objectFit:s.objectFit,objectPosition:s.objectPosition,complete:img.complete,naturalWidth:img.naturalWidth};}));
  const found=images.filter(img=>targets[img.assetPath]);
  for(const img of found){
    const entry=targets[img.assetPath];
    const scale=img.objectFit==='cover'?Math.max(img.width/entry.width,img.height/entry.height):Math.min(img.width/entry.width,img.height/entry.height);
    const visible={left:(entry.width-img.width/scale)/2,top:(entry.height-img.height/scale)/2,right:(entry.width+img.width/scale)/2,bottom:(entry.height+img.height/scale)/2};
    const b=entry.contentBounds;
    img.nativeContentClipping={left:Math.max(0,visible.left-b.left),top:Math.max(0,visible.top-b.top),right:Math.max(0,b.right-visible.right),bottom:Math.max(0,b.bottom-visible.bottom)};
    img.screenshot=`docs/brand-integrated-${route.replaceAll('/','')}-${width}-${entry.sourceLocalPath.split('/').pop()}`;
    await page.locator('img').nth(img.index).screenshot({path:img.screenshot});
  }
  results.push({route,viewport:width,deviceScaleFactor:2,images:found});
  console.log(JSON.stringify(results.at(-1)));
  await page.close();
}
await browser.close();
fs.writeFileSync('docs/remaining-brand-integrated-validation.json',JSON.stringify({origin:'http://localhost:3001',results},null,2)+'\n');
