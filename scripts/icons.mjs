import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const publicDir = new URL('../public/', import.meta.url);
const iconsDir = new URL('icons/', publicDir);

const icons = [
  { file: 'icon-180.png', size: 180, markScale: 1 },
  { file: 'icon-192.png', size: 192, markScale: 1 },
  { file: 'icon-512.png', size: 512, markScale: 1 },
  // Launchers may crop a maskable icon down to the circle in its central 80%, so the mark stays inside it
  { file: 'icon-maskable-192.png', size: 192, markScale: 0.6 },
  { file: 'icon-maskable-512.png', size: 512, markScale: 0.6 },
];

const logo = await readFile(new URL('logo.svg', publicDir), 'utf8');
// An icon is a fixed image on white, so it keeps the light accent whatever the device's colour scheme
const lightLogo = replaceOrThrow(logo, '</style>', '  .mark { color: #2f7d4f }\n</style>');

await mkdir(iconsDir, { recursive: true });
for (const { file, size, markScale } of icons) {
  await sharp(Buffer.from(sized(lightLogo, size, markScale)))
    .flatten({ background: '#ffffff' })
    .png()
    .toFile(fileURLToPath(new URL(file, iconsDir)));
}

function sized(svg, size, markScale) {
  const side = 64 / markScale;
  const origin = (64 - side) / 2;
  return replaceOrThrow(
    svg,
    'viewBox="0 0 64 64"',
    `width="${size}" height="${size}" viewBox="${origin} ${origin} ${side} ${side}"`,
  );
}

function replaceOrThrow(text, pattern, replacement) {
  const result = text.replace(pattern, replacement);
  if (result === text) {
    throw new Error(`logo.svg: nothing matches ${pattern}, so the icons would be wrong`);
  }
  return result;
}
