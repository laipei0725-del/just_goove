import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@just-groove/projects-v1';
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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => setProjects(value ? JSON.parse(value).map(normalizeProject) : []))
      .catch(() => setProjects([]))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(projects)).catch(() => {});
  }, [hydrated, projects]);

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

  const value = useMemo(() => ({ projects, hydrated, addProject, updateProject, deleteProject, duplicateProject }), [projects, hydrated, addProject, updateProject, deleteProject, duplicateProject]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export const useProjects = () => useContext(ProjectContext);
