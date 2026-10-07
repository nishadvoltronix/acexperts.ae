import fs from 'node:fs';

const baselinePath = process.argv[2] || 'docs/site-image-audit-before.json';
const currentPath = process.argv[3] || 'docs/site-image-audit-progress.json';
const output = process.argv[4] || 'docs/site-image-audit-progress-comparison.json';
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = page => page.route + '|' + page.width;
const before = new Map(baseline.pages.map(page => [key(page), page]));
const changes = [];
let geometryCompared = 0;
const invariantFields = ['document', 'font', 'title', 'description', 'canonical', 'robots', 'structuredData', 'visibleBodyText', 'bodyTextContent', 'links', 'controls'];
for (const page of current.pages) {
  const old = before.get(key(page));
  if (!old) { changes.push({ route: page.route, width: page.width, missingBaseline: true }); continue; }
  const changed = { route: page.route, width: page.width, fields: [], geometry: [], geometryClassChanges: [], imageViewportChanges: [], imageChanges: [] };
  for (const field of invariantFields) if (!same(old[field], page[field])) changed.fields.push({ field, before: old[field], after: page[field] });
  if (!same(old.images.map(image => image.alt), page.images.map(image => image.alt))) changed.fields.push({ field: 'imageAlts', before: old.images.map(image => image.alt), after: page.images.map(image => image.alt) });
  if (old.geometry.length !== page.geometry.length) changed.geometry.push({ countBefore: old.geometry.length, countAfter: page.geometry.length });
  for (let i = 0; i < Math.min(old.geometry.length, page.geometry.length); i++) {
    const a = old.geometry[i], b = page.geometry[i];
    geometryCompared++;
    const deltas = Object.fromEntries(['x', 'y', 'width', 'height'].map(d => [d, Math.round((b.rect[d] - a.rect[d]) * 100) / 100]));
    if (a.tag !== b.tag || Object.values(deltas).some(delta => Math.abs(delta) > 0.1)) changed.geometry.push({ index: i, tagBefore: a.tag, tagAfter: b.tag, classBefore: a.className, classAfter: b.className, before: a.rect, after: b.rect, deltas });
    if (a.className !== b.className) changed.geometryClassChanges.push({ index: i, before: a.className, after: b.className });
  }
  if (old.images.length !== page.images.length) changed.imageViewportChanges.push({ countBefore: old.images.length, countAfter: page.images.length });
  for (let i = 0; i < Math.min(old.images.length, page.images.length); i++) {
    const a = old.images[i], b = page.images[i];
    const deltas = Object.fromEntries(['x', 'y', 'width', 'height'].map(d => [d, Math.round((b.viewport[d] - a.viewport[d]) * 100) / 100]));
    if (Object.values(deltas).some(delta => Math.abs(delta) > 0.1)) changed.imageViewportChanges.push({ index: i, alt: a.alt, before: a.viewport, after: b.viewport, deltas });
    if (a.assetPath !== b.assetPath || a.quality !== b.quality || a.sizes !== b.sizes || a.currentSource !== b.currentSource || a.alt !== b.alt) changed.imageChanges.push({ index: i, before: { assetPath: a.assetPath, alt: a.alt, sizes: a.sizes, quality: a.quality, requestedWidth: a.requestedWidth }, after: { assetPath: b.assetPath, alt: b.alt, sizes: b.sizes, quality: b.quality, requestedWidth: b.requestedWidth } });
  }
  changes.push(changed);
}
const sourceChanges = [...new Set([...Object.keys(baseline.sourceHashes), ...Object.keys(current.sourceHashes)])].filter(file => baseline.sourceHashes[file] !== current.sourceHashes[file]).map(file => ({ file, before: baseline.sourceHashes[file] || null, after: current.sourceHashes[file] || null }));
const originalAssetChanges = Object.entries(baseline.assetMetadata).flatMap(([assetPath, metadata]) => current.assetMetadata[assetPath]?.sha256 === metadata.sha256 ? [] : [{ assetPath, before: metadata.sha256, after: current.assetMetadata[assetPath]?.sha256 || null }]);
const report = {
  comparedAt: new Date().toISOString(), baselinePath, currentPath, toleranceCssPixels: 0.1,
  originalAssetPreservation: { compared: Object.keys(baseline.assetMetadata).length, preserved: Object.keys(baseline.assetMetadata).length - originalAssetChanges.length, changes: originalAssetChanges },
  acceptance: {
    geometryToleranceCssPixels: 0.25,
    documentHeightToleranceCssPixels: 1,
    contentMustMatchExactly: true,
    completeCoverage: baseline.pages.every(a => current.pages.some(b => key(a) === key(b))),
    runtimeFailures: current.failures.length,
    failures: changes.flatMap(page => [
      ...(page.fields || []).filter(change => change.field !== 'document' || change.before.width !== change.after.width || Math.abs(change.before.height - change.after.height) > 1).map(change => ({ route: page.route, width: page.width, field: change.field })),
      ...(page.geometry || []).filter(change => !change.deltas || change.tagBefore !== change.tagAfter || Object.values(change.deltas).some(delta => Math.abs(delta) > 0.25)).map(change => ({ route: page.route, width: page.width, geometry: change })),
      ...(page.imageViewportChanges || []).filter(change => !change.deltas || Object.values(change.deltas).some(delta => Math.abs(delta) > 0.25)).map(change => ({ route: page.route, width: page.width, imageViewport: change })),
    ]),
  },
  summary: {
    statesBefore: baseline.pages.length, statesAfter: current.pages.length, missingStates: baseline.pages.filter(a => !current.pages.some(b => key(a) === key(b))).map(key),
    geometryCompared, statesWithInvariantChanges: changes.filter(page => page.fields?.length).length,
    statesWithContentSeoLinkControlOrAltChanges: changes.filter(page => page.fields?.some(change => change.field !== 'document')).length,
    maxGeometryDeltaCssPixels: Math.max(0, ...changes.flatMap(page => (page.geometry || []).flatMap(change => Object.values(change.deltas || {}).map(Math.abs)))),
    maxDocumentHeightDifference: Math.max(0, ...changes.flatMap(page => (page.fields || []).filter(change => change.field === 'document').map(change => Math.abs(change.after.height - change.before.height)))),
    statesWithGeometryChanges: changes.filter(page => page.geometry?.length).length,
    changedGeometryElements: changes.reduce((sum, page) => sum + (page.geometry?.length || 0), 0),
    statesWithImageViewportChanges: changes.filter(page => page.imageViewportChanges?.length).length,
    statesWithClassOnlyChanges: changes.filter(page => page.geometryClassChanges?.length && !page.geometry?.length).length,
    sourceChangedFiles: sourceChanges.map(change => change.file), sourceHashesStableDuringCapture: current.summary?.sourceHashesStable,
    failures: current.failures, overflows: current.summary?.overflows, brokenImages: current.summary?.brokenImages,
  },
  sourceChanges,
  pages: changes,
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, summary: report.summary, changedStates: changes.filter(page => page.fields?.length || page.geometry?.length || page.imageViewportChanges?.length).map(page => ({ route: page.route, width: page.width, fields: page.fields?.map(change => change.field), geometry: page.geometry?.length, imageViewports: page.imageViewportChanges?.length, firstGeometryChange: page.geometry?.[0] })) }, null, 2));
