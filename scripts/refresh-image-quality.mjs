import fs from 'node:fs';

// Source documents record inspected originals and generated replacements.
// Original migration data and public files remain immutable.
const manifests = [
  'site-image-source-upgrades',
  'product-quality-prompts',
  'legacy-photo-quality-prompts',
  'blog-quality-prompts',
  'brand-quality-prompts',
  'brand-quality-prompts-remaining',
];
const result = {};
for (const name of manifests) {
  const file = `docs/${name}.json`;
  if (!fs.existsSync(file)) continue;
  const document = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(document) ? document : document.assets || document.items || document.entries || [];
  for (const item of entries) {
    if (!item.sourceLocalPath || !item.replacementLocalPath || !item.width || !item.height) continue;
    if (item.status && !['accepted', 'complete'].includes(item.status)) continue;
    if (item.inspection === 'pending' || item.inspection === 'rejected') continue;
    if (!fs.existsSync(`public${item.replacementLocalPath}`)) throw new Error(`Missing image: ${item.replacementLocalPath}`);
    result[item.sourceLocalPath] = {localPath:item.replacementLocalPath, width:item.width, height:item.height, ...(item.padded ? {padded:true}: {})};
  }
}
// Follow matching originals through any subsequent quality restoration.
for (const [source, replacement] of Object.entries(result)) {
  const visited = new Set([source]);
  let final = replacement;
  while (result[final.localPath] && !visited.has(final.localPath)) {
    visited.add(final.localPath);
    final = result[final.localPath];
  }
  result[source] = final;
}
fs.writeFileSync('data/image-quality.json', JSON.stringify(result, null, 2) + '\n');
console.log(`Registered ${Object.keys(result).length} image source upgrades.`);
