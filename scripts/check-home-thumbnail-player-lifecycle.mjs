import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/screens/HomeScreen.js', import.meta.url), 'utf8');

const failures = [];

if (/useVideoPlayer\(localUri\)/.test(source)) {
  failures.push('首頁卡片不可為每個縮圖常駐 useVideoPlayer。');
}

if (!/createVideoPlayer/.test(source)) {
  failures.push('縮圖應使用短生命週期的 createVideoPlayer。');
}

if (!/player\.release\(\)/.test(source)) {
  failures.push('產生縮圖後必須釋放 VideoPlayer。');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Home thumbnail player lifecycle contract passed.');
