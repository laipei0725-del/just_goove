const preferredMimeTypes = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const recorderMimeType = () => preferredMimeTypes.find((value) => MediaRecorder.isTypeSupported(value)) || '';

const fitRect = (sourceWidth, sourceHeight, targetWidth, targetHeight, fit = 'contain') => {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const useWidth = fit === 'cover' ? sourceRatio < targetRatio : sourceRatio > targetRatio;
  const width = useWidth ? targetWidth : targetHeight * sourceRatio;
  const height = useWidth ? targetWidth / sourceRatio : targetHeight;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
};

export const getRecordingCanvasSize = (aspectRatio = 'auto', sourceWidth = 1080, sourceHeight = 1920) => {
  if (aspectRatio === '16:9') return { width: 1280, height: 720 };
  if (aspectRatio === '9:16') return { width: 720, height: 1280 };
  if (aspectRatio === '1:1') return { width: 1080, height: 1080 };
  return sourceWidth >= sourceHeight ? { width: 1280, height: 720 } : { width: 720, height: 1280 };
};

const createHiddenVideo = (stream) => {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.srcObject = stream;
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);
  video.play().catch(() => {});
  return video;
};

const getVideoSize = (video) => ({
  width: video.videoWidth || video.clientWidth || 1280,
  height: video.videoHeight || video.clientHeight || 720,
});

const seekVideo = (video, seconds) => new Promise((resolve) => {
  const target = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const done = () => {
    video.removeEventListener('seeked', done);
    video.removeEventListener('canplay', done);
    resolve();
  };
  video.addEventListener('seeked', done, { once: true });
  video.addEventListener('canplay', done, { once: true });
  video.currentTime = target;
  setTimeout(done, 700);
});

const drawMirroredVideo = (context, video, rect, mirrored = false) => {
  context.save();
  if (mirrored) {
    context.translate(rect.x + rect.width, rect.y);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, rect.width, rect.height);
  } else {
    context.drawImage(video, rect.x, rect.y, rect.width, rect.height);
  }
  context.restore();
};

export async function startCleanPracticeRecording({
  sourceVideo,
  cameraVideo,
  aspectRatio = 'auto',
  crop = 'contain',
  cameraMode = 'pip',
  mirrored = false,
  startAt = 0,
  endAt = null,
  durationSeconds = null,
  playbackRate = 1,
  includeCamera = true,
  content = 'camera',
  onStopped,
  onError,
} = {}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('此瀏覽器無法錄製練習畫面，請使用最新版桌面 Chrome。');
  }
  if (content !== 'camera' && (!sourceVideo || sourceVideo.readyState < 2)) throw new Error('影片尚未準備好，請先播放影片後再錄影。');

  let ownedCameraStream = null;
  let hiddenCameraVideo = null;
  let activeCameraVideo = includeCamera ? cameraVideo : null;
  if (includeCamera && !activeCameraVideo && navigator.mediaDevices?.getUserMedia) {
    ownedCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    hiddenCameraVideo = createHiddenVideo(ownedCameraStream);
    activeCameraVideo = hiddenCameraVideo;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const sourceSize = content === 'camera' && activeCameraVideo ? getVideoSize(activeCameraVideo) : getVideoSize(sourceVideo);
  const canvasSize = getRecordingCanvasSize(aspectRatio, sourceSize.width, sourceSize.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('瀏覽器無法建立錄製畫布。');

  const videoStream = canvas.captureStream(30);
  const mixedStream = new MediaStream(videoStream.getVideoTracks());
  if (sourceVideo?.captureStream) {
    sourceVideo.captureStream().getAudioTracks().forEach((track) => mixedStream.addTrack(track));
  } else if (ownedCameraStream) {
    ownedCameraStream.getAudioTracks().forEach((track) => mixedStream.addTrack(track));
  }

  const mimeType = recorderMimeType();
  const recorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  let startedAt = Date.now();
  let stopped = false;
  let frameId = null;
  let durationTimer = null;

  const draw = () => {
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (content !== 'camera') {
      const sourceRect = fitRect(sourceSize.width, sourceSize.height, canvas.width, canvas.height, crop);
      drawMirroredVideo(context, sourceVideo, sourceRect, mirrored);
    }

    if (includeCamera && activeCameraVideo?.readyState >= 2) {
      const cameraSize = getVideoSize(activeCameraVideo);
      if (content === 'camera') {
        const cameraRect = fitRect(cameraSize.width, cameraSize.height, canvas.width, canvas.height, 'cover');
        drawMirroredVideo(context, activeCameraVideo, cameraRect, true);
      } else if (cameraMode === 'split') {
        const half = canvas.width / 2;
        const leftRect = fitRect(sourceSize.width, sourceSize.height, half, canvas.height, crop);
        const rightRect = fitRect(cameraSize.width, cameraSize.height, half, canvas.height, 'cover');
        context.fillRect(0, 0, canvas.width, canvas.height);
        drawMirroredVideo(context, sourceVideo, { ...leftRect, x: leftRect.x }, mirrored);
        drawMirroredVideo(context, activeCameraVideo, { ...rightRect, x: half + rightRect.x }, true);
      } else if (cameraMode === 'overlay') {
        const cameraRect = fitRect(cameraSize.width, cameraSize.height, canvas.width, canvas.height, 'cover');
        drawMirroredVideo(context, activeCameraVideo, cameraRect, true);
      } else {
        const pipWidth = canvas.width * 0.28;
        const pipHeight = canvas.width >= canvas.height ? pipWidth * 9 / 16 : pipWidth * 16 / 9;
        const pipRect = fitRect(cameraSize.width, cameraSize.height, pipWidth, pipHeight, 'cover');
        drawMirroredVideo(context, activeCameraVideo, {
          x: canvas.width * 0.04 + pipRect.x,
          y: canvas.height - pipHeight - canvas.width * 0.04 + pipRect.y,
          width: pipRect.width,
          height: pipRect.height,
        }, true);
      }
    }

    if (content !== 'camera' && Number.isFinite(endAt) && sourceVideo.currentTime >= endAt - 0.04) {
      stop();
      return;
    }
    frameId = requestAnimationFrame(draw);
  };

  const cleanup = () => {
    if (frameId) cancelAnimationFrame(frameId);
    if (durationTimer) clearTimeout(durationTimer);
    mixedStream.getTracks().forEach((track) => track.stop());
    ownedCameraStream?.getTracks().forEach((track) => track.stop());
    hiddenCameraVideo?.remove();
    sourceVideo?.removeEventListener?.('ended', stop);
  };

  function stop() {
    if (stopped) return;
    stopped = true;
    try { sourceVideo?.pause?.(); } catch {}
    if (recorder.state !== 'inactive') recorder.stop();
  }

  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
  recorder.onerror = (event) => {
    cleanup();
    onError?.(event.error || new Error('錄製失敗'));
  };
  recorder.onstop = () => {
    cleanup();
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    const uri = URL.createObjectURL(blob);
    onStopped?.({ uri, blob, mimeType: blob.type, duration: Math.max(0, (Date.now() - startedAt) / 1000) });
  };

  if (content !== 'camera') {
    sourceVideo.addEventListener('ended', stop, { once: true });
    await seekVideo(sourceVideo, startAt);
    sourceVideo.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    await sourceVideo.play();
  }
  recorder.start(250);
  startedAt = Date.now();
  if (content === 'camera' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    durationTimer = setTimeout(stop, durationSeconds * 1000);
  }
  draw();

  return { stop, stream: mixedStream };
}
