import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/utils/browserTabRecorder.js', import.meta.url), 'utf8');
const match = source.match(/export const getRecordingCanvasSize = ([\s\S]*?);\n\nconst requestCameraStream/);
assert.ok(match, 'getRecordingCanvasSize export must exist');
const getRecordingCanvasSize = Function(`return (${match[1]});`)();
const ratio = ({ width, height }) => Number((width / height).toFixed(4));

assert.equal(ratio(getRecordingCanvasSize('9:16')), Number((9 / 16).toFixed(4)));
assert.equal(ratio(getRecordingCanvasSize('16:9')), Number((16 / 9).toFixed(4)));
assert.equal(ratio(getRecordingCanvasSize('1:1')), 1);
assert.equal(ratio(getRecordingCanvasSize('auto', 1920, 1080)), Number((16 / 9).toFixed(4)));
assert.equal(ratio(getRecordingCanvasSize('auto', 1080, 1920)), Number((9 / 16).toFixed(4)));

console.log('recording layout ratios ok');
