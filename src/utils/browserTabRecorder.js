const preferredMimeTypes = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

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
  const mimeType = preferredMimeTypes.find((value) => MediaRecorder.isTypeSupported(value)) || '';
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
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const link = document.createElement('a');
    link.href = uri;
    link.download = `just-groove-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    link.click();
    onStopped?.({ uri, blob, mimeType: blob.type, duration: Math.max(0, (Date.now() - startedAt) / 1000) });
  };
  stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (recorder.state !== 'inactive') recorder.stop(); });
  recorder.start(250);
  startedAt = Date.now();
  return { stop: () => { if (recorder.state !== 'inactive') recorder.stop(); }, stream };
}
