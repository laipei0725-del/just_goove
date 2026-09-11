// Keep durable Storage paths in data; signed URLs are temporary playback credentials.
export const BUCKET = 'user-videos';
export const serializeProject = (project) => {
  const media = (item) => item?.storagePath ? { ...item, uri: null } : item;
  return { ...project, source: media(project.source), recordings: (project.recordings || []).map(media) };
};

export function createCloudProjects(client, uploadFile) {
  const check = (result) => { if (result.error) throw result.error; return result.data; };
  const assertOwner = async (owner) => {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== owner) throw new Error('帳號已切換，請重新登入後再試。');
  };
  const hydrate = async (project, owner) => {
    const sign = async (item) => {
      if (!item?.storagePath) return item;
      if (!item.storagePath.startsWith(`${owner}/`)) throw new Error('影片不屬於目前帳號。');
      const data = check(await client.storage.from(BUCKET).createSignedUrl(item.storagePath, 7200));
      return { ...item, uri: data.signedUrl };
    };
    return { ...project, source: await sign(project.source), recordings: await Promise.all((project.recordings || []).map(sign)) };
  };
  const prepare = async (project, owner, progress) => {
    await assertOwner(owner);
    const upload = async (item, name) => {
      if (!item || item.storagePath) return item;
      if (!item.uri) throw new Error('找不到影片，請重新選取原始影片。');
      const response = await fetch(item.uri);
      if (!response.ok) throw new Error('無法讀取原始影片，請重新選取。');
      const blob = await response.blob();
      const path = `${owner}/${project.id}/${name}`;
      await uploadFile(path, blob, progress, owner);
      await assertOwner(owner);
      return { ...item, storagePath: path };
    };
    const source = project.source?.type === 'local' ? await upload(project.source, 'original') : project.source;
    const recordings = [];
    for (const item of project.recordings || []) recordings.push(await upload(item, `recording-${item.id}`));
    return { ...project, ownerId: owner, source, recordings };
  };
  return {
    hydrate,
    async load(owner) {
      await assertOwner(owner);
      const rows = check(await client.from('dance_projects').select('*').eq('user_id', owner).order('updated_at', { ascending: false }));
      return Promise.all(rows.map((row) => hydrate({ ...row.data, id: row.id, title: row.title, ownerId: owner }, owner)));
    },
    async save(project, owner, progress) {
      const prepared = await prepare(project, owner, progress);
      await assertOwner(owner);
      check(await client.from('dance_projects').upsert({ id: prepared.id, user_id: owner, title: prepared.title, data: serializeProject(prepared), updated_at: new Date(prepared.updatedAt).toISOString() }, { onConflict: 'user_id,id' }));
      return prepared;
    },
    async remove(project, owner) {
      await assertOwner(owner);
      // List the project folder as well, so interrupted uploads are cleaned up.
      const prefix = `${owner}/${project.id}`;
      while (true) {
        const files = check(await client.storage.from(BUCKET).list(prefix, { limit: 100 }));
        if (!files.length) break;
        check(await client.storage.from(BUCKET).remove(files.map((file) => `${prefix}/${file.name}`)));
      }
      check(await client.from('dance_projects').delete().eq('id', project.id).eq('user_id', owner));
    },
  };
}
