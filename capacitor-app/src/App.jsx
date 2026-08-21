import { useEffect, useMemo, useRef, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { listVideos, removeVideo, saveVideo, sourceFor } from './videoLibrary';

const icons = { home: '⌂', play: '▷', folder: '▱', progress: '▥', settings: '⚙', mirror: '⇄', camera: '◉', share: '↗', full: '⛶', close: '×', collapse: '▾', headphones: '♬' };
const LAST_VIDEO_KEY = 'just-groove:last-video';

const newId = () => globalThis.crypto?.randomUUID?.() || `video-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const formatTime = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function parseVideoUrl(value) {
  const originalUrl = value.trim();
  try {
    const url = new URL(originalUrl);
    const host = url.hostname.replace('www.', '').toLowerCase();
    if (host === 'youtu.be' || host.endsWith('youtube.com')) {
      const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
      if (!id) throw new Error('找不到 YouTube 影片識別碼。');
      return { type: 'youtube', originalUrl, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`, title: 'YouTube 影片' };
    }
    if (host.endsWith('instagram.com')) {
      const match = url.pathname.match(/^\/(reel|p|tv)\/([^/?#]+)/i);
      if (!match) throw new Error('請貼上公開 Instagram Reels 或貼文連結。');
      const [, kind, id] = match;
      return { type: 'instagram', originalUrl, embedUrl: `https://www.instagram.com/${kind}/${id}/embed/captioned/`, title: 'Instagram 影片' };
    }
    throw new Error('目前僅支援 YouTube 與公開 Instagram 影片連結。');
  } catch (error) {
    throw new Error(error.message || '影片連結格式不正確。');
  }
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [videos, setVideos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ab, setAb] = useState({ enabled: false, start: null, end: null });
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraOpacity, setCameraOpacity] = useState(.6);
  const [isImmersive, setIsImmersive] = useState(false);
  const [immersiveControlsOpen, setImmersiveControlsOpen] = useState(true);
  const fileInput = useRef(null);
  const videoRef = useRef(null);
  const cameraRef = useRef(null);
  const streamRef = useRef(null);
  const lastSavedTime = useRef(0);

  const active = videos.find((video) => video.id === activeId) || null;
  const activeSource = useMemo(() => active ? sourceFor(active) : null, [active?.id]);
  const localVideo = active?.type === 'local';
  const canPrecisionControl = localVideo;
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;

  const buzz = () => Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  const showMessage = (text) => { setMessage(text); window.setTimeout(() => setMessage(''), 3600); };

  useEffect(() => {
    listVideos().then((items) => {
      const sorted = items.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      setVideos(sorted);
      const previousId = localStorage.getItem(LAST_VIDEO_KEY);
      if (previousId && sorted.some((item) => item.id === previousId)) setActiveId(previousId);
    }).catch(() => showMessage('無法讀取影片庫，請重新開啟 App。'));
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!active) return;
    localStorage.setItem(LAST_VIDEO_KEY, active.id);
    setTime(active.resumeAt || 0);
    setDuration(active.duration || 0);
    setPlaying(false);
    setAb({ enabled: false, start: null, end: null });
  }, [activeId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, activeId]);

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (cameraRef.current) cameraRef.current.srcObject = stream;
      })
      .catch(() => { setCameraOn(false); showMessage('請在 iPhone 設定中允許相機權限。'); });
  }, [cameraOn]);

  async function persist(video) {
    await saveVideo(video);
    setVideos((current) => [video, ...current.filter((item) => item.id !== video.id)].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)));
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const now = Date.now();
    const video = { id: newId(), type: 'local', title: file.name.replace(/\.[^.]+$/, '') || '未命名影片', blob: file, createdAt: now, updatedAt: now, resumeAt: 0, duration: 0 };
    await persist(video);
    openVideo(video.id);
  }

  async function importUrl() {
    try {
      const parsed = parseVideoUrl(url);
      const now = Date.now();
      const video = { id: newId(), ...parsed, createdAt: now, updatedAt: now, resumeAt: 0, duration: 0 };
      await persist(video);
      setUrl('');
      openVideo(video.id);
    } catch (error) { showMessage(error.message); }
  }

  function openVideo(id) { setActiveId(id); setTab('practice'); buzz(); }

  async function saveResume(nextTime) {
    if (!active || !localVideo) return;
    const updated = { ...active, resumeAt: nextTime, updatedAt: Date.now() };
    await persist(updated);
  }

  function onTimeUpdate(event) {
    const current = event.currentTarget.currentTime;
    if (ab.enabled && ab.end !== null && current >= ab.end) {
      event.currentTarget.currentTime = ab.start || 0;
      return;
    }
    setTime(current);
    if (Math.abs(current - lastSavedTime.current) > 3) {
      lastSavedTime.current = current;
      saveResume(current).catch(() => {});
    }
  }

  function seek(value) {
    const next = Number(value);
    if (videoRef.current) videoRef.current.currentTime = next;
    setTime(next);
  }

  function togglePlay() {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
  }

  function adjustSpeed(delta) {
    setSpeed((value) => Math.min(2, Math.max(.1, Number((value + delta).toFixed(1)))));
    buzz();
  }

  async function shareVideo() {
    if (!navigator.share) return showMessage('此裝置不支援系統分享。');
    try {
      await navigator.share({ title: active?.title || 'JUST GROOVE', url: active?.originalUrl });
    } catch (error) {
      if (error?.name === 'AbortError') return showMessage('已取消分享');
      console.error('[JUST GROOVE] Share failed:', error);
      showMessage('分享失敗，請稍後再試。');
    }
  }

  function toggleImmersive() {
    setIsImmersive((current) => !current);
    setImmersiveControlsOpen(true);
    buzz();
  }

  function setAbPoint(point) {
    if (!canPrecisionControl) return showMessage('Instagram 與 YouTube 受平台限制，請使用播放器內建進度列定位。');
    setAb((current) => ({ ...current, [point]: time }));
    buzz();
  }

  function toggleAb() {
    if (!canPrecisionControl) return showMessage('AB 循環支援匯入到影片庫的本機影片。');
    if (ab.start === null || ab.end === null || ab.end <= ab.start) return showMessage('請先在不同時間點設定 A 與 B。');
    setAb((current) => ({ ...current, enabled: !current.enabled }));
    buzz();
  }

  async function renameVideo() {
    const target = videos.find((video) => video.id === renameId);
    const title = renameValue.trim();
    if (!target || !title) return;
    await persist({ ...target, title, updatedAt: Date.now() });
    setRenameId(null);
  }

  async function deleteVideo(id) {
    const target = videos.find((video) => video.id === id);
    if (!target || !window.confirm(`要刪除「${target.title}」嗎？此操作無法復原。`)) return;
    await removeVideo(id);
    setVideos((current) => current.filter((video) => video.id !== id));
    if (activeId === id) { setActiveId(null); localStorage.removeItem(LAST_VIDEO_KEY); }
  }

  const nav = [['home', icons.home, '首頁'], ['practice', icons.play, '練舞鏡'], ['library', icons.folder, '影片庫'], ['progress', icons.progress, '學習進度'], ['settings', icons.settings, '設定']];

  return <main className="app-shell">
    <header><span className="brand-dot" /><strong>JUST GROOVE</strong><span className="header-note">Dance Practice Pro</span></header>
    {message && <div className="toast" role="status">{message}</div>}

    {tab === 'home' && <section className="page home">
      <p className="eyebrow">YOUR PRACTICE</p><h1>開始你的練習</h1><p className="muted">從影片庫匯入影片，或貼上 YouTube、Instagram 連結。</p>
      <div className="progress-card glass"><div className="card-title">你的練習資料</div><div className="stats"><div><small>影片庫</small><b>{videos.length} <em>部</em></b></div><div><small>上次播放</small><b className="last-title">{active ? active.title : '尚無'}</b></div></div></div>
      <h2>快速開始</h2><div className="quick-grid"><button className="quick purple" onClick={() => setTab('practice')}><span>{icons.play}</span><strong>開啟練舞鏡</strong><small>進度、鏡像、AB 循環</small></button><button className="quick lime" onClick={() => fileInput.current?.click()}><span>{icons.folder}</span><strong>匯入練習影片</strong><small>從相簿選擇你的影片</small></button></div>
      <h2>上次學習</h2>{active ? <button className="clip" onClick={() => openVideo(active.id)}><span className="clip-icon">▶</span><span><strong>{active.title}</strong><small>從 {formatTime(active.resumeAt || 0)} 繼續播放</small></span><b>›</b></button> : <div className="empty-list">尚未開始練習。匯入一部影片後，進度會自動保存。</div>}
    </section>}

    {tab === 'practice' && <section className="page practice">
      <div className="section-heading"><div><p className="eyebrow">PRACTICE STUDIO</p><h1>{active?.title || '練舞鏡'}</h1></div><button className="outline" onClick={() => setTab('library')}>影片庫</button></div>
      {!workspaceCollapsed && <div className="workspace glass"><div className="workspace-title"><strong>加入練習影片</strong><button className="icon-button" aria-label="收合工作區" onClick={() => setWorkspaceCollapsed(true)}>{icons.collapse}</button></div><div className="url-row"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="貼上 YouTube 或 Instagram 公開連結" /><button onClick={importUrl}>匯入</button></div><button className="import-inline" onClick={() => fileInput.current?.click()}>＋ 從相簿匯入影片</button></div>}
      {workspaceCollapsed && <button className="expand-workspace" onClick={() => setWorkspaceCollapsed(false)}>＋ 展開工作區，加入或切換影片</button>}
      <div className={isImmersive ? 'immersive-shell' : ''}>
      <div className={`stage ${mirror ? 'mirrored' : ''}`}>
        {!active && <div className="empty-stage"><span>✦</span><strong>選擇影片開始練習</strong><small>貼上 YouTube／Instagram 連結或從相簿匯入</small></div>}
        {active?.type === 'local' && <video ref={videoRef} src={activeSource} playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedMetadata={(event) => { const total = event.currentTarget.duration; setDuration(total); event.currentTarget.currentTime = active.resumeAt || 0; if (!active.duration) persist({ ...active, duration: total, updatedAt: Date.now() }); }} onTimeUpdate={onTimeUpdate} />}
        {active?.type === 'youtube' && <iframe title="YouTube player" src={active.embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
        {active?.type === 'instagram' && <iframe title="Instagram player" src={active.embedUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
        {cameraOn && <video className="camera-overlay" ref={cameraRef} autoPlay muted playsInline style={{ opacity: cameraOpacity }} />}
        {active?.type === 'instagram' && <a className="open-source" href={active.originalUrl} target="_blank" rel="noreferrer">在 Instagram 開啟 ↗</a>}
        <div className="tool-rail"><button aria-label="耳機模式">{icons.headphones}</button><button aria-label="鏡像" className={mirror ? 'active' : ''} onClick={() => setMirror(!mirror)}>{icons.mirror}</button><button aria-label="分享" onClick={shareVideo}>{icons.share}</button><button aria-label="相機對比" className={cameraOn ? 'active' : ''} onClick={() => setCameraOn(!cameraOn)}>{icons.camera}</button><button aria-label={isImmersive ? '離開沉浸模式' : '進入沉浸模式'} onClick={toggleImmersive}>{isImmersive ? icons.close : icons.full}</button></div>
      </div>
      {isImmersive && active && <div className={`immersive-controls ${immersiveControlsOpen ? 'open' : 'collapsed'}`}>
        <button className="immersive-handle" aria-label={immersiveControlsOpen ? '收合控制列' : '展開控制列'} onClick={() => setImmersiveControlsOpen((current) => !current)}><i />{immersiveControlsOpen ? '收合控制列' : '展開控制列'}</button>
        {immersiveControlsOpen && <div className="immersive-controls-body">
          {canPrecisionControl ? <><div className="immersive-timeline"><input aria-label="全螢幕播放進度" className="timeline" type="range" min="0" max={duration || 1} step="0.1" value={time} onChange={(event) => seek(event.target.value)} />{ab.start !== null && <b className="ab-marker a" style={{ left: `${duration ? (ab.start / duration) * 100 : 0}%` }}>A</b>}{ab.end !== null && <b className="ab-marker b" style={{ left: `${duration ? (ab.end / duration) * 100 : 0}%` }}>B</b>}</div><div className="immersive-time"><span>{formatTime(time)}</span><span>{formatTime(duration)}</span></div></> : <p className="player-note">此來源請使用內建播放器控制列定位秒數。</p>}
          <div className="immersive-actions"><button className={ab.enabled ? 'selected' : ''} onClick={toggleAb}>循環</button><button onClick={() => setImmersiveControlsOpen(true)}>工具</button><button className="immersive-play" onClick={togglePlay}>{playing ? 'Ⅱ' : '▶'}</button><button aria-label="減慢 0.1 倍" onClick={() => adjustSpeed(-.1)}>−</button><button className="speed-readout" aria-label={`目前速度 ${speed.toFixed(1)} 倍`}>{speed.toFixed(1)}x</button><button aria-label="加快 0.1 倍" onClick={() => adjustSpeed(.1)}>＋</button></div>
          {canPrecisionControl && <div className="immersive-ab"><button onClick={() => setAbPoint('start')} className={ab.start !== null ? 'filled' : ''}>設定 A {ab.start !== null && formatTime(ab.start)}</button><span>在時間軸選定 A／B 區段</span><button onClick={() => setAbPoint('end')} className={ab.end !== null ? 'filled' : ''}>設定 B {ab.end !== null && formatTime(ab.end)}</button></div>}
        </div>}
      </div>}
      </div>
      {active && <div className="controls glass"><div className="control-top"><button className={mirror ? 'selected' : ''} onClick={() => setMirror(!mirror)}>{icons.mirror} 鏡像</button><div className="speed"><button aria-label="減慢 0.1 倍" onClick={() => setSpeed((value) => Math.max(.1, Number((value - .1).toFixed(1))))}>−</button><b>{speed.toFixed(1)}x</b><button aria-label="加快 0.1 倍" onClick={() => setSpeed((value) => Math.min(2, Number((value + .1).toFixed(1))))}>＋</button></div><button className={ab.enabled ? 'selected' : ''} onClick={toggleAb}>AB 循環</button></div>
        {canPrecisionControl ? <><input aria-label="播放進度" className="timeline" type="range" min="0" max={duration || 1} step="0.1" value={time} onChange={(event) => seek(event.target.value)} /><div className="time-row"><span>{formatTime(time)}</span><button className="play-button" onClick={togglePlay}>{playing ? 'Ⅱ' : '▶'}</button><span>−{formatTime(Math.max(duration - time, 0))}</span></div><div className="ab-panel"><button onClick={() => setAbPoint('start')} className={ab.start !== null ? 'filled' : ''}>設定 A {ab.start !== null && formatTime(ab.start)}</button><span>選定想重複練習的區段</span><button onClick={() => setAbPoint('end')} className={ab.end !== null ? 'filled' : ''}>設定 B {ab.end !== null && formatTime(ab.end)}</button></div></> : <p className="player-note">{active.type === 'youtube' ? 'YouTube 可使用內建進度列跳到指定秒數。' : 'Instagram 公開影片已使用官方嵌入；部分帳號可能限制內嵌，請使用「在 Instagram 開啟」。'}</p>}
        {cameraOn && <label className="opacity">相機透明度 <input type="range" min=".2" max="1" step=".05" value={cameraOpacity} onChange={(event) => setCameraOpacity(Number(event.target.value))} /></label>}
      </div>}
    </section>}

    {tab === 'library' && <section className="page library"><p className="eyebrow">YOUR COLLECTION</p><h1>影片庫</h1><button className="import-card" onClick={() => fileInput.current?.click()}><span>＋</span><strong>從相簿匯入練習影片</strong><small>影片會安全保留在此裝置的 App 資料中</small></button><div className="library-url"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="貼上 YouTube 或 Instagram 公開連結" /><button onClick={importUrl}>加入</button></div>{videos.length ? videos.map((video) => <article className="library-item" key={video.id}><button className="video-open" onClick={() => openVideo(video.id)}><span className="clip-icon">{video.type === 'local' ? '▶' : video.type === 'youtube' ? 'YT' : 'IG'}</span><span><strong>{video.title}</strong><small>{video.type === 'local' ? `從 ${formatTime(video.resumeAt || 0)} 繼續` : video.type === 'youtube' ? 'YouTube' : 'Instagram'}</small></span></button><div className="item-actions"><button onClick={() => { setRenameId(video.id); setRenameValue(video.title); }}>改名</button><button className="danger" onClick={() => deleteVideo(video.id)}>刪除</button></div></article>) : <div className="empty-list">影片庫目前是空的。你匯入的影片和連結會顯示在這裡。</div>}</section>}

    {tab === 'progress' && <section className="page"><p className="eyebrow">YOUR RHYTHM</p><h1>學習進度</h1><div className="progress-card glass"><div className="card-title">目前資料</div><b className="big-number">{videos.length} <em>部影片</em></b><p className="muted">匯入與觀看影片後，這裡會顯示你的實際練習進度。</p></div></section>}
    {tab === 'settings' && <section className="page"><p className="eyebrow">PREFERENCES</p><h1>設定</h1><div className="settings glass"><label><span>練習時保持螢幕常亮<small>支援的裝置會在練習時自動請求</small></span><b className="switch on" /></label><label><span>資料儲存位置<small>影片資料保留在這台裝置</small></span><b className="switch on" /></label></div></section>}
    {renameId && <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="rename-modal glass" onSubmit={(event) => { event.preventDefault(); renameVideo(); }}><h2>修改影片名稱</h2><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /><div><button type="button" onClick={() => setRenameId(null)}>取消</button><button type="submit">儲存</button></div></form></div>}
    <input ref={fileInput} type="file" accept="video/*" hidden onChange={importFile} />
    <nav>{nav.map(([key, icon, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); buzz(); }}><span>{icon}</span>{label}</button>)}</nav>
  </main>;
}
