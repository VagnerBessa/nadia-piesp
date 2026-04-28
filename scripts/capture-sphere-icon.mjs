import { chromium } from 'playwright';
import sharp from '../node_modules/sharp/lib/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const browser = await chromium.launch({
  args: ['--enable-webgl', '--use-gl=angle', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });

// Abre a landing page no dev server
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

// Aguarda a esfera renderizar (WebGL precisa de alguns frames)
await page.waitForTimeout(2500);

// Localiza o canvas da esfera (DitheringShader)
const canvas = page.locator('canvas').first();
await canvas.waitFor({ state: 'visible' });

// Screenshot do canvas como PNG buffer
const rawBuf = await canvas.screenshot({ type: 'png' });

// Detecta as dimensões reais
const meta = await sharp(rawBuf).metadata();
const size = Math.min(meta.width, meta.height); // garante quadrado
const squareBuf = await sharp(rawBuf)
  .extract({ left: Math.round((meta.width - size) / 2), top: Math.round((meta.height - size) / 2), width: size, height: size })
  .toBuffer();

async function saveIcon(sizePx, outFile) {
  await sharp(squareBuf)
    .resize(sizePx, sizePx, { fit: 'fill' })
    .png()
    .toFile(outFile);
  console.log(`✓ ${path.basename(outFile)} (${sizePx}×${sizePx})`);
}

await saveIcon(512, path.join(root, 'public', 'icon-512x512.png'));
await saveIcon(192, path.join(root, 'public', 'icon-192x192.png'));
await saveIcon(180, path.join(root, 'public', 'apple-touch-icon.png'));

await browser.close();
console.log('Ícones gerados a partir da esfera renderizada.');
