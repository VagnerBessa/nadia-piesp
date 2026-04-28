import { chromium } from 'playwright';
import sharp from '../node_modules/sharp/lib/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--ignore-gpu-blocklist'],
});

// Viewport largo para que as classes md: do Tailwind se apliquem (md = 768px)
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

// Aguarda WebGL renderizar completamente
await page.waitForTimeout(2500);

// Captura o div container da esfera (rounded-full overflow-hidden)
// Isso já devolve a esfera recortada em círculo, sem fundo negro extra ao redor
const sphereContainer = page.locator('div.rounded-full.overflow-hidden').first();
await sphereContainer.waitFor({ state: 'visible' });

const rawBuf = await sphereContainer.screenshot({ type: 'png' });

// Garante quadrado perfeito (a div pode ter 288 ou 384px dependendo do breakpoint)
const meta = await sharp(rawBuf).metadata();
const cropSize = Math.min(meta.width, meta.height);
const squareBuf = await sharp(rawBuf)
  .extract({
    left: Math.round((meta.width - cropSize) / 2),
    top: Math.round((meta.height - cropSize) / 2),
    width: cropSize,
    height: cropSize,
  })
  .toBuffer();

// Gera ícone com padding para safe zone do macOS/iOS (superelipse arredonda ~17%)
// Esfera ocupa ~68% do ícone → margem de 16% de cada lado
async function saveIcon(sizePx, outFile) {
  const PADDING_RATIO = 0.16;
  const padding = Math.round(sizePx * PADDING_RATIO);
  const innerSize = sizePx - padding * 2;

  const sphereBuf = await sharp(squareBuf)
    .resize(innerSize, innerSize, { fit: 'fill' })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: sizePx,
      height: sizePx,
      channels: 4,
      background: { r: 11, g: 34, b: 49, alpha: 1 }, // #0b2231
    },
  })
    .composite([{ input: sphereBuf, left: padding, top: padding }])
    .png()
    .toFile(outFile);

  console.log(`✓ ${path.basename(outFile)} (${sizePx}×${sizePx}, sphere ${innerSize}px, padding ${padding}px)`);
}

await saveIcon(512, path.join(root, 'public', 'icon-512x512.png'));
await saveIcon(192, path.join(root, 'public', 'icon-192x192.png'));
await saveIcon(180, path.join(root, 'public', 'apple-touch-icon.png'));

await browser.close();
console.log('Ícones gerados com círculo limpo da esfera.');
