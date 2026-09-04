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

if (/ytRef\.current\?\.(playVideo|pauseVideo|setPlaybackRate)/.test(source)) {
  failures.push('不可呼叫 react-native-youtube-iframe ref 未提供的播放或倍速方法。');
}

if (!/const handleYoutubeStateChange = useCallback/.test(source)) {
  failures.push('YouTube 播放器事件必須由單一狀態同步函式處理。');
}

if (!/initialPlayerParams=\{YOUTUBE_PLAYER_PARAMS\}/.test(source) || !/controls:\s*false/.test(source)) {
  failures.push('修復完成後必須隱藏 YouTube 原生控制列。');
}

if (!/height=\{youtubeFrame\.height\}/.test(source) || !/width=\{youtubeFrame\.width\}/.test(source)) {
  failures.push('YouTube 播放器必須使用計算後的數值寬高，不能使用 100% 字串。');
}

if (!/getAspectFitSize/.test(source) || !/isVerticalYoutube\s*\?\s*9\s*\/\s*16/.test(source)) {
  failures.push('Shorts 必須使用 9:16 contain 版面計算。');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('YouTube speed and immediate AB toggle contract passed.');
