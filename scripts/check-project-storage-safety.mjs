import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/store/ProjectContext.js', import.meta.url), 'utf8');
const requiredGuards = [
  "const BACKUP_STORAGE_KEY = '@just-groove/projects-v1-last-known-good'",
  "if (!Array.isArray(parsed)) throw new Error('Project storage is not an array')",
  "setStorageReady(true)",
  'if (!hydrated || !storageReady) return undefined',
  'await AsyncStorage.setItem(BACKUP_STORAGE_KEY, lastPersistedValue.current)',
  "APP 不會覆寫或清除你的專案",
];

for (const guard of requiredGuards) {
  if (!source.includes(guard)) throw new Error(`Missing project storage safety guard: ${guard}`);
}

const catchBlock = source.match(/catch \(error\) \{\n\s*console\.warn\('JUST GROOVE project storage was not loaded; preserving existing data\.'/);
if (!catchBlock) throw new Error('Load failure must preserve storage instead of resetting projects.');

console.log('Project storage safety checks passed.');
