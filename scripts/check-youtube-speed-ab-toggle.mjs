import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/screens/PracticeScreen.js', import.meta.url), 'utf8');
const failures = [];

if (!/getAvailablePlaybackRates/.test(source)) {
  failures.push('YouTube 倍速必須讀取該影片實際支援的播放速度。');
}

if (!/youtubeRates/.test(source)) {
  failures.push('YouTube 支援速度必須保存在畫面狀態中。');
}

if (!/const \[playMode, setPlayModeState\]/.test(source)) {
  failures.push('AB 播放模式需要本地狀態，才能立即關閉。');
}

if (!/setPlayMode\('full-loop'\)/.test(source)) {
  failures.push('AB 關閉操作必須立即切換到非 AB 模式。');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('YouTube speed and immediate AB toggle contract passed.');
