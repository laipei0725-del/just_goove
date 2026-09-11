import { Upload } from 'tus-js-client';
import { supabase, supabaseUrl } from './supabaseClient';

export async function uploadCloudVideo(path, blob, onProgress, owner) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== owner) throw new Error('請登入後再上傳影片。');
  const endpoint = new URL(supabaseUrl);
  if (endpoint.hostname.endsWith('.supabase.co')) endpoint.hostname = endpoint.hostname.replace('.supabase.co', '.storage.supabase.co');
  endpoint.pathname = '/storage/v1/upload/resumable';
  return new Promise((resolve, reject) => {
    const upload = new Upload(blob, {
      endpoint: endpoint.href,
      headers: { authorization: `Bearer ${data.session.access_token}`, 'x-upsert': 'true' },
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Include the owner and destination to prevent resuming another account's upload.
      fingerprint: () => Promise.resolve(`just-groove:${path}:${blob.size}:${blob.type}`),
      metadata: { bucketName: 'user-videos', objectName: path, contentType: blob.type || 'video/mp4', cacheControl: '3600' },
      onBeforeRequest: async (request) => {
        const { data: current } = await supabase.auth.getSession();
        if (current.session?.user.id !== owner) throw new Error('帳號已切換，上傳已停止。');
        request.setHeader('authorization', `Bearer ${current.session.access_token}`);
      },
      onProgress: (sent, total) => onProgress?.(Math.round(sent / total * 100)),
      onError: () => reject(new Error('影片上傳失敗，請檢查網路與雲端容量後重試。')),
      onSuccess: resolve,
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
}
