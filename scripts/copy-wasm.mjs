import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.join(process.cwd(), 'node_modules/@rhwp/core/rhwp_bg.wasm');
const target = path.join(process.cwd(), 'public/rhwp_bg.wasm');

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
