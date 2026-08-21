import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/screens/PracticeScreen.js', import.meta.url), 'utf8');

const requirements = [
  ['requests microphone permission separately', /useMicrophonePermissions\s*\(/],
  ['renders the camera in video mode', /<CameraView[\s\S]*?mode=["']video["']/],
  ['tracks the camera-ready callback', /onCameraReady=/],
  ['blocks recording until the camera is ready', /cameraReady/],
];

const failures = requirements.filter(([, pattern]) => !pattern.test(source));

if (failures.length) {
  console.error(`camera recording contract failed: ${failures.map(([name]) => name).join(', ')}`);
  process.exit(1);
}

console.log('camera recording contract passed');
