import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@just-groove/projects-v1';
const BACKUP_STORAGE_KEY = '@just-groove/projects-v1-last-known-good';
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
  skipSeconds: project.skipSeconds || 5,
  cameraMode: project.cameraMode || 'pip',
  bookmarks: project.bookmarks || [],
  recordings: project.recordings || [],
  updatedAt: project.updatedAt || Date.now(),
});

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const lastPersistedValue = useRef(null);

  useEffect(() => {
    let active = true;

    const loadProjects = async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEY);
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
          setProjects(parsed.map(normalizeProject));
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
  }, []);

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
          await AsyncStorage.setItem(BACKUP_STORAGE_KEY, lastPersistedValue.current);
        }
        await AsyncStorage.setItem(STORAGE_KEY, nextValue);
        if (active) lastPersistedValue.current = nextValue;
      } catch (error) {
        console.warn('JUST GROOVE project storage was not saved.', error);
        if (active) setStorageError('新的變更暫時無法儲存；既有專案資料沒有被刪除。');
      }
    };

    persistProjects();
    return () => { active = false; };
  }, [hydrated, projects, storageReady]);

  const addProject = useCallback((input) => {
    const project = normalizeProject({ ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    setProjects((items) => [project, ...items]);
    return project;
  }, []);

  const updateProject = useCallback((id, patch) => {
    setProjects((items) => items.map((item) => item.id === id ? normalizeProject({ ...item, ...patch, updatedAt: Date.now() }) : item));
  }, []);

  const deleteProject = useCallback((id) => setProjects((items) => items.filter((item) => item.id !== id)), []);
  const duplicateProject = useCallback((id) => {
    setProjects((items) => {
      const source = items.find((item) => item.id === id);
      if (!source) return items;
      const copy = normalizeProject({ ...source, id: `${Date.now()}-copy`, title: `${source.title} 副本`, thumbnailKey: source.thumbnailKey || `justgroove-thumbnail-${source.id}`, updatedAt: Date.now() });
      return [copy, ...items];
    });
  }, []);

  const value = useMemo(() => ({ projects, hydrated, storageError, addProject, updateProject, deleteProject, duplicateProject }), [projects, hydrated, storageError, addProject, updateProject, deleteProject, duplicateProject]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export const useProjects = () => useContext(ProjectContext);
