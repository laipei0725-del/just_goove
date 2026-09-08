const preferredMimeTypes = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const recorderMimeType = () => preferredMimeTypes.find((value) => MediaRecorder.isTypeSupported(value)) || '';

export async function startOriginalVideoRecording({ videoElement, onStopped, onError } = {}) {
  if (!videoElement?.captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('此瀏覽器無法直接錄製原影片，請使用最新版桌面 Chrome。');
  }
  const stream = videoElement.captureStream();
  if (!stream.getVideoTracks().length) throw new Error('原影片尚未準備好，請先播放影片後再錄影。');
  const mimeType = recorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const startedAt = Date.now();
  let stopped = false;
  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
  recorder.onerror = (event) => onError?.(event.error || new Error('原影片錄製失敗'));
  recorder.onstop = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    const uri = URL.createObjectURL(blob);
    onStopped?.({ uri, blob, mimeType: blob.type, duration: Math.max(0, (Date.now() - startedAt) / 1000) });
  };
  recorder.start(250);
  return { stop: () => { if (recorder.state !== 'inactive') recorder.stop(); }, stream };
}

export async function startBrowserTabRecording({ onStopped, onError } = {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('此 Chrome 版本不支援分頁合成錄製');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30, cursor: 'never', displaySurface: 'browser' },
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  });
  const mimeType = recorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  let startedAt = Date.now();
  let stopped = false;
  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
  recorder.onerror = (event) => onError?.(event.error || new Error('錄製失敗'));
  recorder.onstop = () => {
    if (stopped) return;
    stopped = true;
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    const uri = URL.createObjectURL(blob);
    onStopped?.({ uri, blob, mimeType: blob.type, duration: Math.max(0, (Date.now() - startedAt) / 1000) });
  };
  stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (recorder.state !== 'inactive') recorder.stop(); });
  recorder.start(250);
  startedAt = Date.now();
  return { stop: () => { if (recorder.state !== 'inactive') recorder.stop(); }, stream };
}
