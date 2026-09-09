import assert from 'node:assert/strict';
import youtubeUrl from '../src/utils/youtubeUrl.cjs';

const { extractYouTubeId } = youtubeUrl;

const id = 'dQw4w9WgXcQ';
for (const url of [
  `https://www.youtube.com/watch?v=${id}&t=12`,
  `https://youtu.be/${id}?si=share`,
  `https://youtube.com/shorts/${id}`,
  `https://m.youtube.com/embed/${id}`,
  `youtube.com/live/${id}`,
]) assert.equal(extractYouTubeId(url), id, url);

for (const value of ['', null, 'not a url', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short']) assert.equal(extractYouTubeId(value), null, String(value));
console.log('YouTube URL safety contract passed.');
