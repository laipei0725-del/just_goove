import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { createCloudProjects } from '../services/cloudProjects.mjs';
import { uploadCloudVideo } from '../services/cloudUpload';

const STORAGE_KEY = '@just-groove/projects-v1';
const STORAGE_PREFIX = '@just-groove/projects-v2:';
const ProjectContext = createContext(null);

const normalizeProject = (project) => ({
  id: project.id || `${Date.now()}`,
  title: project.title || '未命名練習',
  source: project.source,
  coverUri: project.coverUri || null,
  thumbnailKey: project.thumbnailKey || null,
  durationMs: Number.isFinite(project.durationMs) ? project.durationMs : null,
  createdAt: project.createdAt || project.updatedAt || Date.now(),
  speed: project.speed || 1,
  position: project.position || 0,
  crop: project.crop || 'contain',
  aspectRatio: project.aspectRatio || 'auto',
  playMode: project.playMode || 'full-loop',
  trimStart: Number.isFinite(project.trimStart) ? project.trimStart : 0,
  trimEnd: Number.isFinite(project.trimEnd) ? project.trimEnd : 0,
  mirrored: Boolean(project.mirrored),
  abStart: Number.isFinite(project.abStart) ? project.abStart : null,
  abEnd: Number.isFinite(project.abEnd) ? project.abEnd : null,
  activeBookmarkId: project.activeBookmarkId || null,
  frameStep: [24, 30, 60].includes(project.frameStep) ? project.frameStep : 30,
  skipSeconds: project.skipSeconds || 5,
  cameraMode: project.cameraMode || 'pip',
  recordingContent: project.recordingContent || 'camera',
  bookmarks: project.bookmarks || [],
  recordings: project.recordings || [],
  updatedAt: project.updatedAt || Date.now(),
  pinned: Boolean(project.pinned),
  ownerId: project.ownerId || 'guest',
});

export function ProjectProvider({ children }) {
  const { user, ready } = useAuth();
  return <OwnerProjects key={user?.id || 'guest'} ownerId={user?.id || 'guest'} authReady={ready}>{children}</OwnerProjects>;
}

function OwnerProjects({ children, ownerId, authReady }) {
  const storageKey = `${STORAGE_PREFIX}${ownerId}`;
  const cloud = useMemo(() => supabase && ownerId !== 'guest' ? createCloudProjects(supabase, uploadCloudVideo) : null, [ownerId]);
  const [projects, setProjects] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const items = useRef([]);
  const dirty = useRef(new Set());
  const mounted = useRef(true);
  const chain = useRef(Promise.resolve());
  const cacheChain = useRef(Promise.resolve());
  const deleting = useRef(new Set());
  const cloudReady = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const publish = useCallback((next) => { items.current = next; setProjects(next); }, []);
  const enqueue = useCallback((work) => {
    const next = chain.current.catch(() => {}).then(work);
    chain.current = next;
    return next;
  }, []);
  const persist = useCallback(() => {
    const value = JSON.stringify({ projects: items.current, dirtyIds: [...dirty.current] });
    cacheChain.current = cacheChain.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, value));
    return cacheChain.current;
  }, [storageKey]);

  useEffect(() => {
    if (!authReady) return undefined;
    let active = true;
    setHydrated(false);
    const load = async () => {
      try {
        let raw = await AsyncStorage.getItem(storageKey);
        // Legacy projects stay exclusively in the guest namespace.
        if (raw === null && ownerId === 'guest') raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const local = Array.isArray(parsed) ? parsed : parsed.projects;
        if (!Array.isArray(local)) throw new Error('Invalid local projects');
        const pending = new Set(Array.isArray(parsed.dirtyIds) ? parsed.dirtyIds : []);
        if (!active) return;
        dirty.current = pending;
        publish(local.map((p) => normalizeProject({ ...p, ownerId })));
        if (cloud) {
          const remote = await cloud.load(ownerId);
          if (!active) return;
          const map = new Map(remote.map((p) => [p.id, normalizeProject(p)]));
          local.filter((p) => pending.has(p.id)).forEach((p) => map.set(p.id, normalizeProject({ ...p, ownerId })));
          publish([...map.values()]);
          cloudReady.current = true;
        }
        setStorageError(null);
        await persist();
      } catch {
        if (active) setStorageError(cloud ? '雲端專案暫時無法載入；本機資料已保留，請重試。' : '本機資料無法讀取，請勿清除瀏覽器資料。');
      } finally {
        if (active) { setHydrated(true); setRevision((n) => n + 1); }
      }
    };
    load();
    return () => { active = false; };
  }, [authReady, cloud, ownerId, storageKey, loadAttempt, publish, persist]);

  useEffect(() => {
    if (!hydrated || !cloud || !cloudReady.current || !dirty.current.size) return undefined;
    const timer = setTimeout(() => {
      enqueue(async () => {
        if (!mounted.current) return;
        for (const id of [...dirty.current]) {
          if (deleting.current.has(id)) continue;
          const snapshot = items.current.find((p) => p.id === id);
          if (!snapshot) continue;
          try {
            setSyncStatus('正在同步影片與設定…');
            const saved = await cloud.save(snapshot, ownerId, (percent) => {
              if (mounted.current) setSyncStatus(`影片上傳中 ${percent}% · 完成前請保留此頁`);
            });
            if (!mounted.current) return;
            const current = items.current.find((p) => p.id === id);
            if (!current) continue;
            const unchanged = JSON.stringify(current) === JSON.stringify(snapshot);
            const recordings = current.recordings.map((r) => {
              const uploaded = saved.recordings.find((s) => s.id === r.id);
              return uploaded ? { ...r, storagePath: uploaded.storagePath } : r;
            });
            publish(items.current.map((p) => p.id === id ? { ...p, source: { ...p.source, storagePath: saved.source?.storagePath }, recordings } : p));
            if (unchanged) dirty.current.delete(id);
            await persist();
            setStorageError(null);
          } catch (error) {
            if (mounted.current) { setStorageError(error.message || '同步失敗，請重試。'); setSyncStatus('尚未同步完成'); }
            return;
          }
        }
        if (mounted.current) {
          setSyncStatus(dirty.current.size ? '尚有變更待同步' : '已同步到雲端');
          if (dirty.current.size) setRevision((n) => n + 1);
        }
      }).catch(() => { if (mounted.current) setStorageError('同步失敗，請重試。'); });
    }, 600);
    return () => clearTimeout(timer);
  }, [revision, hydrated, cloud, ownerId, enqueue, persist, publish]);

  useEffect(() => {
    if (!cloud || !hydrated) return undefined;
    const refresh = () => enqueue(async () => {
      if (!mounted.current || dirty.current.size) return;
      try {
        const next = await Promise.all(items.current.map((p) => cloud.hydrate(p, ownerId)));
        if (mounted.current && !dirty.current.size) publish(next);
      } catch {}
    });
    const timer = setInterval(refresh, 60 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); };
  }, [cloud, hydrated, enqueue, ownerId, publish]);

  const change = useCallback((next, id) => {
    if (!hydrated) throw new Error('專案仍在載入，請稍候。');
    dirty.current.add(id);
    publish(next);
    persist().catch(() => setStorageError('本機儲存失敗，請保留此頁並重試。'));
    setRevision((n) => n + 1);
  }, [hydrated, publish, persist]);
  const addProject = useCallback((input) => {
    const project = normalizeProject({ ...input, ownerId, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` });
    change([project, ...items.current], project.id);
    return project;
  }, [change, ownerId]);
  const updateProject = useCallback((id, patch) => {
    if (!items.current.some((p) => p.id === id)) return;
    change(items.current.map((p) => p.id === id ? normalizeProject({ ...p, ...patch, ownerId, updatedAt: Date.now() }) : p), id);
  }, [change, ownerId]);
  const deleteProject = useCallback(async (id) => {
    const project = items.current.find((p) => p.id === id);
    if (!project) return;
    deleting.current.add(id);
    try {
      if (cloud) await enqueue(() => cloud.remove(project, ownerId));
      if (!mounted.current) return;
      dirty.current.delete(id);
      publish(items.current.filter((p) => p.id !== id));
      await persist();
    } catch (error) {
      if (mounted.current) setStorageError('刪除未完成，請重試；專案記錄仍保留。');
      throw error;
    } finally { deleting.current.delete(id); }
  }, [cloud, enqueue, ownerId, publish, persist]);
  const duplicateProject = useCallback((id) => {
    const original = items.current.find((p) => p.id === id);
    if (!original) return;
    // Copies own their files, so deleting one never breaks another.
    const copyMedia = (media) => media ? { ...media, storagePath: undefined } : media;
    return addProject({ ...original, title: `${original.title} 副本`, source: copyMedia(original.source), recordings: original.recordings.map(copyMedia), createdAt: Date.now(), updatedAt: Date.now() });
  }, [addProject]);
  const retrySync = () => {
    setStorageError(null);
    if (cloud && !cloudReady.current) setLoadAttempt((n) => n + 1);
    else { persist().catch(() => setStorageError('本機儲存失敗。')); setRevision((n) => n + 1); }
  };
  return <ProjectContext.Provider value={{ projects, hydrated, storageError, syncStatus, retrySync, ownerId, addProject, updateProject, deleteProject, duplicateProject }}>{children}</ProjectContext.Provider>;
}

export const useProjects = () => useContext(ProjectContext);
