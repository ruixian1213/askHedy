// 由 assets/hedy.svg 產生 app icon / splash / favicon / android foreground，
// 並把 SVG 內容寫成 src/lib/hedySvg.ts 供 app 內的 HedyAvatar 使用。
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'assets/hedy.svg'), 'utf8');

function render(svgText, size, out) {
  const r = new Resvg(svgText, { fitTo: { mode: 'width', value: size } });
  writeFileSync(join(root, out), r.render().asPng());
  console.log('wrote', out, size);
}

// 完整圖示（iOS 會自動加圓角）
render(svg, 1024, 'assets/icon.png');
// Splash：透明底、留白
const padded = svg
  .replace(/<rect width="1024" height="1024" fill="url\(#bg\)"\/>/, '')
  .replace('<svg ', '<svg style="background:transparent" ');
const framed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <g transform="translate(192 192) scale(0.625)">${padded.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>
</svg>`;
render(framed, 1024, 'assets/splash-icon.png');
render(framed, 1024, 'assets/android-icon-foreground.png');
render(svg, 64, 'assets/favicon.png');

mkdirSync(join(root, 'src/lib'), { recursive: true });
writeFileSync(
  join(root, 'src/lib/hedySvg.ts'),
  `// 由 scripts/make-icons.mjs 自動產生，請改 assets/hedy.svg\nexport const HEDY_SVG = ${JSON.stringify(svg)};\n`,
);
console.log('wrote src/lib/hedySvg.ts');
