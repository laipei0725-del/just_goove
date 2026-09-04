// Captures a frame from a local video file using a browser <video> element
// and draws it to a canvas. Web-only fallback for expo-video's
// generateThumbnailsAsync, which is not supported on web yet.
export function captureVideoFrameAsync(uri, { time = 0.05, maxWidth = 480, maxHeight = 640 } = {}) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = uri;

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };

    const capture = () => {
      try {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        if (!videoWidth || !videoHeight) {
          finish(null);
          return;
        }
        const scale = Math.min(maxWidth / videoWidth, maxHeight / videoHeight, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(videoWidth * scale));
        canvas.height = Math.max(1, Math.round(videoHeight * scale));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        finish(null);
      }
    };

    video.addEventListener('error', () => finish(null), { once: true });
    video.addEventListener('loadedmetadata', () => {
      try {
        video.currentTime = Math.min(Math.max(0, time), Math.max(0, (video.duration || 0) - 0.05));
      } catch {
        capture();
      }
    }, { once: true });
    video.addEventListener('seeked', capture, { once: true });
    setTimeout(() => capture(), 8000);
    video.load();
  });
}
