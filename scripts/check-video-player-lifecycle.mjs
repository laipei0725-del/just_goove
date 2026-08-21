import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/screens/PracticeScreen.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /return\s*\(\)\s*=>\s*\{[^}]*player\.(?:pause|play|release)\s*\(/s,
  'PracticeScreen cleanup must not call a useVideoPlayer instance after Expo begins automatic disposal',
);

console.log('video player lifecycle check passed');
