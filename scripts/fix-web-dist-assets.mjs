import fs from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const originalAssetDir = path.join(distDir, 'assets', 'node_modules');
const deployableAssetDir = path.join(distDir, 'assets', 'expo-node-assets');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filePath));
    else files.push(filePath);
  }
  return files;
}

if (await exists(originalAssetDir)) {
  await fs.rm(deployableAssetDir, { recursive: true, force: true });
  await fs.rename(originalAssetDir, deployableAssetDir);
}

const files = (await walk(distDir)).filter((filePath) => {
  return /\.(html|js|css|json)$/.test(filePath);
});

for (const filePath of files) {
  const current = await fs.readFile(filePath, 'utf8');
  const next = current.replaceAll('/assets/node_modules/', '/assets/expo-node-assets/');
  if (next !== current) await fs.writeFile(filePath, next);
}

console.log('Prepared Expo web dist assets for Vercel.');
