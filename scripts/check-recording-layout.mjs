import assert from 'node:assert/strict';
import { getRecordingCanvasSize } from '../src/utils/browserTabRecorder.js';

const ratio = ({ width, height }) => Number((width / height).toFixed(4));

assert.equal(ratio(getRecordingCanvasSize('9:16')), Number((9 / 16).toFixed(4)));
assert.equal(ratio(getRecordingCanvasSize('16:9')), Number((16 / 9).toFixed(4)));
assert.equal(ratio(getRecordingCanvasSize('1:1')), 1);
assert.equal(ratio(getRecordingCanvasSize('auto', 1920, 1080)), Number((16 / 9).toFixed(4)));
assert.equal(ratio(getRecordingCanvasSize('auto', 1080, 1920)), Number((9 / 16).toFixed(4)));

console.log('recording layout ratios ok');
