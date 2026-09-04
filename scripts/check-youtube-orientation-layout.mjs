import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const screenPath = new URL('../src/screens/PracticeScreen.js', import.meta.url);
const layoutPath = new URL('../src/utils/youtubeLayout.cjs', import.meta.url);
const appConfigPath = new URL('../app.json', import.meta.url);
const source = fs.readFileSync(screenPath, 'utf8');
const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
const failures = [];

if (!fs.existsSync(layoutPath)) {
  failures.push('缺少可獨立測試的 YouTube Aspect Fit 版面計算。');
} else {
  const { getAspectFitSize } = require(fileURLToPath(layoutPath));
  const cases = [
    { width: 390, height: 600, ratio: 9 / 16 },
    { width: 844, height: 390, ratio: 9 / 16 },
    { width: 390, height: 600, ratio: 16 / 9 },
    { width: 844, height: 390, ratio: 16 / 9 },
  ];

  for (const testCase of cases) {
    const result = getAspectFitSize(testCase.width, testCase.height, testCase.ratio);
    const ratio = result.width / result.height;
    if (result.width > testCase.width + 0.01 || result.height > testCase.height + 0.01) {
      failures.push('Aspect Fit 結果超出可用 Container。');
    }
    if (Math.abs(ratio - testCase.ratio) > 0.001) {
      failures.push('Aspect Fit 沒有維持影片比例。');
    }
    const usesWidth = Math.abs(result.width - testCase.width) < 0.01;
    const usesHeight = Math.abs(result.height - testCase.height) < 0.01;
    if (!usesWidth && !usesHeight) failures.push('Aspect Fit 沒有最大化使用可用空間。');
  }
}

const contracts = [
  [/addOrientationChangeListener/, 'YouTube 頁面必須訂閱系統 Orientation 變化。'],
  [/youtubeViewportSize/, 'YouTube Player 必須依實際 Container onLayout 尺寸計算。'],
  [/handleYoutubeViewportLayout/, '缺少 YouTube Container onLayout 處理。'],
  [/controlsVisible/, '缺少 Controls 顯示／隱藏狀態。'],
  [/controlsHideTimerRef/, '缺少 Controls 自動隱藏計時器。'],
  [/insets\.left/, 'Landscape 必須使用左側 Safe Area。'],
  [/insets\.right/, 'Landscape 必須使用右側 Safe Area。'],
  [/initialPlayerParams=\{YOUTUBE_PLAYER_PARAMS\}/, 'YouTube iframe 原生 Controls 必須維持關閉。'],
  [/preventFullScreen:\s*true/, 'YouTube iframe 自己的 Full Screen 必須關閉，由 App 管理。'],
  [/<VideoView ref=\{videoRef\} player=\{player\} style=\{styles\.fill\} contentFit=\{videoFit\} nativeControls=\{false\}/, '本機影片播放器路徑不可被改壞。'],
];

for (const [pattern, message] of contracts) {
  if (!pattern.test(source)) failures.push(message);
}

if (/<YoutubePlayer[^>]*\skey=/.test(source)) {
  failures.push('YoutubePlayer 不可因方向變化更換 key 或重新建立。');
}

if (appConfig.expo?.orientation !== 'default' || appConfig.expo?.ios?.requireFullScreen !== true) {
  failures.push('iOS 必須允許方向切換，並停用會干擾方向鎖定的 iPad Split View。');
}

if (failures.length) {
  console.error([...new Set(failures)].join('\n'));
  process.exit(1);
}

console.log('YouTube orientation, aspect-fit, controls, safe-area, and local-video contracts passed.');
