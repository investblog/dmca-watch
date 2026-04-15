// Regenerate PNG icons from src/public/icons/icon.svg.
// Requires: npm install --no-save @resvg/resvg-js
// Run:      node scripts/render-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'src', 'public', 'icons');
const svgPath = resolve(iconsDir, 'icon.svg');
const svg = readFileSync(svgPath);

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  const outPath = resolve(iconsDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}
