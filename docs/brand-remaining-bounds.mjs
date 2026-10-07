import fs from 'node:fs';
import sharp from 'sharp';
async function bounds(file){
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {left,top,right,bottom};
}
const file='docs/brand-quality-prompts-remaining.json';
const manifest=JSON.parse(fs.readFileSync(file));
for(const entry of manifest.entries){
  entry.sourceContentBounds=await bounds('public'+entry.sourceLocalPath);
  entry.contentBounds=await bounds('public'+entry.replacementLocalPath);
}
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
console.log(manifest.entries.map(({sourceLocalPath,sourceContentBounds,contentBounds})=>({sourceLocalPath,sourceContentBounds,contentBounds})));
