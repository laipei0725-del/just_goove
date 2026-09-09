function extractYouTubeId(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = null;
    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0];
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      candidate = url.searchParams.get('v');
      if (!candidate) {
        const [kind, id] = url.pathname.split('/').filter(Boolean);
        if (['embed', 'v', 'shorts', 'live'].includes(kind)) candidate = id;
      }
    }
    return /^[\w-]{11}$/.test(candidate || '') ? candidate : null;
  } catch {
    return null;
  }
}

module.exports = { extractYouTubeId };
