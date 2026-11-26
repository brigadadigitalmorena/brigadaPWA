#!/usr/bin/env node
/**
 * Regenerates the PWA icons from public/icons/icon-source.png (the white B).
 * Requires Python 3 and Pillow. Does not draw a placeholder.
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = `
from PIL import Image
from pathlib import Path
root = Path(${JSON.stringify(root)})
out = root / "public" / "icons"
base = Image.open(out / "icon-source.png").convert("RGBA")
sizes = [72, 96, 128, 144, 152, 192, 384, 512]
for size in sizes:
    icon = base.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(out / f"icon-{size}x{size}.png", "PNG")
    print(f"wrote {size}")
base.save(root / "src" / "app" / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon")
`;

const result = spawnSync('python3', ['-c', script], { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('No se regeneraron los iconos. Hace falta Python 3 con Pillow.');
  process.exit(result.status ?? 1);
}
