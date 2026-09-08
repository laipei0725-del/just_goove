// A single offscreen decoder per batch; never seeks or pauses the visible player.
export async function videoFilmstrip(uri, times, signal) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  const wait = (event, action) => new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener('error', fail);
      signal?.removeEventListener('abort', fail);
    };
    const ready = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('無法讀取影片影格')); };
    video.addEventListener(event, ready, { once: true });
    video.addEventListener('error', fail, { once: true });
    signal?.addEventListener('abort', fail, { once: true });
    timer = setTimeout(fail, 8000);
    if (signal?.aborted) return fail();
    try { action(); } catch { fail(); }
  });
  try {
    await wait('loadeddata', () => { video.src = uri; video.load(); });
    const canvas = document.createElement('canvas');
    const scale = Math.min(200 / video.videoWidth, 120 / video.videoHeight, 1);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    const result = [];
    for (const time of times) {
      if (signal?.aborted) throw new Error('Cancelled');
      const target = Math.max(0, Math.min(time, video.duration - 0.001));
      if (Math.abs(video.currentTime - target) > 0.0001) await wait('seeked', () => { video.currentTime = target; });
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      result.push(canvas.toDataURL('image/jpeg', 0.72));
    }
    return result;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
