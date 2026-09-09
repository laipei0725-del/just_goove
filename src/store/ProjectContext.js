import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

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
  bookmarks: project.bookmarks || [],
  recordings: project.recordings || [],
  updatedAt: project.updatedAt || Date.now(),
  pinned: Boolean(project.pinned),
  ownerId: project.ownerId || 'guest',
});

export function ProjectProvider({ children }) {
  const { user } = useAuth();
  const ownerId = user?.id || 'guest';
  const storageKey = `${STORAGE_PREFIX}${ownerId}`;
  const backupKey = `${storageKey}:last-known-good`;
  const [projects, setProjects] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const lastPersistedValue = useRef(null);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    setStorageReady(false);
    setStorageError(null);
    setProjects([]);
    lastPersistedValue.current = null;

    const loadProjects = async () => {
      try {
        let value = await AsyncStorage.getItem(storageKey);
        // One-time migration keeps existing local projects visible in guest mode.
        if (value === null && ownerId === 'guest') value = await AsyncStorage.getItem(STORAGE_KEY);
        if (!active) return;

        // An empty key means this is a new installation. A malformed value is
        // different: never replace it with an empty list, because that would
        // erase an existing user's projects after a transient read failure.
        if (value === null) {
          lastPersistedValue.current = JSON.stringify([]);
          setProjects([]);
        } else {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error('Project storage is not an array');
          lastPersistedValue.current = value;
          setProjects(parsed.map((item) => normalizeProject({ ...item, ownerId })));
        }
        if (supabase && ownerId !== 'guest') {
          let guestProjects = [];
          try {
            const guestValue = await AsyncStorage.getItem(`${STORAGE_PREFIX}guest`);
            if (guestValue) guestProjects = JSON.parse(guestValue).map((item) => normalizeProject({ ...item, ownerId }));
          } catch (error) { console.warn('JUST GROOVE guest migration skipped', error.message); }
          const { data: remote, error } = await supabase.from('dance_projects').select('*').eq('user_id', ownerId).order('updated_at', { ascending: false });
          if (!error && Array.isArray(remote)) {
            const remoteProjects = remote.map((row) => normalizeProject({ ...row.data, id: row.id, ownerId, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at }));
            const merged = [...remoteProjects, ...guestProjects.filter((guest) => !remoteProjects.some((item) => item.id === guest.id))];
            setProjects(merged);
            if (guestProjects.length) {
              const migrationRows = guestProjects.map((project) => ({ id: String(project.id), user_id: ownerId, title: project.title, data: project, updated_at: new Date().toISOString() }));
              await supabase.from('dance_projects').upsert(migrationRows, { onConflict: 'user_id,id' });
              await AsyncStorage.removeItem(`${STORAGE_PREFIX}guest`);
            }
          }
        }
        setStorageReady(true);
      } catch (error) {
        console.warn('JUST GROOVE project storage was not loaded; preserving existing data.', error);
        if (active) setStorageError('練舞專案暫時無法讀取。為保護既有資料，APP 不會覆寫或清除你的專案。');
      } finally {
        if (active) setHydrated(true);
      }
    };

    loadProjects();
    return () => { active = false; };
  }, [ownerId, storageKey]);

  useEffect(() => {
    if (!hydrated || !storageReady) return undefined;
    const nextValue = JSON.stringify(projects);
    if (nextValue === lastPersistedValue.current) return undefined;

    let active = true;
    const persistProjects = async () => {
      try {
        // Keep the last verified value as a recovery copy before changing the
        // main key. Project media itself is never touched by this operation.
        if (lastPersistedValue.current !== null) {
          await AsyncStorage.setItem(backupKey, lastPersistedValue.current);
        }
        await AsyncStorage.setItem(storageKey, nextValue);
        if (active) lastPersistedValue.current = nextValue;
      } catch (error) {
        console.warn('JUST GROOVE project storage was not saved.', error);
        if (active) setStorageError('新的變更暫時無法儲存；既有專案資料沒有被刪除。');
      }
    };

    persistProjects();
    if (supabase && ownerId !== 'guest') {
      const rows = projects.map((project) => ({ id: String(project.id), user_id: ownerId, title: project.title, data: project, updated_at: new Date().toISOString() }));
      supabase.from('dance_projects').upsert(rows, { onConflict: 'user_id,id' }).then(({ error }) => { if (error) console.warn('JUST GROOVE remote project sync failed', error.message); });
    }
    return () => { active = false; };
  }, [backupKey, hydrated, ownerId, projects, storageKey, storageReady]);

  const addProject = useCallback((input) => {
    const project = normalizeProject({ ...input, ownerId, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    setProjects((items) => [project, ...items]);
    return project;
  }, [ownerId]);

  const updateProject = useCallback((id, patch) => {
    setProjects((items) => items.map((item) => item.id === id ? normalizeProject({ ...item, ...patch, updatedAt: Date.now() }) : item));
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects((items) => items.filter((item) => item.id !== id));
    if (supabase && ownerId !== 'guest') supabase.from('dance_projects').delete().eq('id', String(id)).eq('user_id', ownerId).then(({ error }) => { if (error) console.warn('JUST GROOVE remote delete failed', error.message); });
  }, [ownerId]);
  const duplicateProject = useCallback((id) => {
    setProjects((items) => {
      const source = items.find((item) => item.id === id);
      if (!source) return items;
      const copy = normalizeProject({ ...source, id: `${Date.now()}-copy`, title: `${source.title} 副本`, thumbnailKey: source.thumbnailKey || `justgroove-thumbnail-${source.id}`, updatedAt: Date.now() });
      return [copy, ...items];
    });
  }, []);

  const value = useMemo(() => ({ projects, hydrated, storageError, ownerId, addProject, updateProject, deleteProject, duplicateProject }), [projects, hydrated, storageError, ownerId, addProject, updateProject, deleteProject, duplicateProject]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export const useProjects = () => useContext(ProjectContext);
