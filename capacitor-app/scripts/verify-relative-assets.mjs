import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const built = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const absoluteAsset = /(?:src|href)=["']\/(?!\/)/;

for (const [name, html] of [['source', source], ['built', built]]) {
  if (absoluteAsset.test(html)) {
    throw new Error(`${name} index.html contains an absolute asset path.`);
  }
}

console.log('Relative asset path verification passed.');
