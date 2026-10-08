import { supabase } from "@/integrations/supabase/client";
import type { Permission } from "./apps";

export const BUCKET = "life-drive";

export type DriveFolder = { id: string; owner_id: string; parent_id: string | null; name: string; trashed_at: string | null; created_at: string; updated_at: string };
export type DriveFile = { id: string; owner_id: string; folder_id: string | null; name: string; storage_path: string; mime_type: string; size_bytes: number; trashed_at: string | null; last_opened_at: string | null; created_at: string; updated_at: string };
export type DriveShare = { id: string; owner_id: string; resource_type: "file" | "folder"; file_id: string | null; folder_id: string | null; shared_with: string | null; shared_with_email: string | null; permission: Permission; link_token: string | null; created_at: string };
export type Item = ({ kind: "folder" } & DriveFolder) | ({ kind: "file" } & DriveFile);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Faça login");
  return data.user.id;
}
const ok = <T,>(r: { data: T; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export async function listAll() {
  const [folders, files, favs, shares] = await Promise.all([
    db.from("drive_folders").select("*"),
    db.from("drive_files").select("*"),
    db.from("drive_favorites").select("file_id, folder_id"),
    db.from("drive_shares").select("*"),
  ]);
  return {
    folders: ok(folders) as DriveFolder[],
    files: ok(files) as DriveFile[],
    favorites: new Set<string>((ok(favs) as { file_id: string | null; folder_id: string | null }[]).map((f) => (f.file_id ?? f.folder_id)!)),
    shares: ok(shares) as DriveShare[],
  };
}

export async function createFolder(name: string, parent_id: string | null) {
  const owner_id = await uid();
  return ok(await db.from("drive_folders").insert({ name, parent_id, owner_id }).select().single()) as DriveFolder;
}

export async function uploadFile(file: File, folder_id: string | null, onProgress: (p: number) => void, displayName?: string) {
  const owner_id = await uid();
  const id = crypto.randomUUID();
  const path = `${owner_id}/${id}`;
  // XHR para ter progresso real
  const { data: s } = await supabase.auth.getSession();
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${s.session?.access_token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || "Falha no envio")));
    xhr.onerror = () => reject(new Error("Falha de rede"));
    xhr.send(file);
  });
  return ok(await db.from("drive_files").insert({
    id, owner_id, folder_id, name: displayName ?? file.name, storage_path: path,
    mime_type: file.type || "application/octet-stream", size_bytes: file.size,
  }).select().single()) as DriveFile;
}

/** Garante a árvore de pastas para upload de pasta (webkitRelativePath). */
export async function ensurePath(parts: string[], root: string | null, cache: Map<string, string>) {
  let parent = root;
  let key = root ?? "";
  for (const p of parts) {
    key += "/" + p;
    if (!cache.has(key)) cache.set(key, (await createFolder(p, parent)).id);
    parent = cache.get(key)!;
  }
  return parent;
}

export async function rename(item: Item, name: string) {
  ok(await db.from(item.kind === "file" ? "drive_files" : "drive_folders").update({ name }).eq("id", item.id));
}
export async function move(item: Item, target: string | null) {
  if (item.kind === "file") ok(await db.from("drive_files").update({ folder_id: target }).eq("id", item.id));
  else ok(await db.from("drive_folders").update({ parent_id: target }).eq("id", item.id));
}
export async function setTrashed(item: Item, trashed: boolean) {
  ok(await db.from(item.kind === "file" ? "drive_files" : "drive_folders").update({ trashed_at: trashed ? new Date().toISOString() : null }).eq("id", item.id));
}
export async function destroy(item: Item, allFiles: DriveFile[], allFolders: DriveFolder[]) {
  // coleta arquivos dentro (recursivo) para limpar do storage
  const paths: string[] = [];
  if (item.kind === "file") paths.push(item.storage_path);
  else {
    const ids = new Set([item.id]);
    let grew = true;
    while (grew) { grew = false; for (const f of allFolders) if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) { ids.add(f.id); grew = true; } }
    allFiles.filter((f) => f.folder_id && ids.has(f.folder_id)).forEach((f) => paths.push(f.storage_path));
    ok(await db.from("drive_files").delete().in("folder_id", [...ids]));
  }
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  ok(await db.from(item.kind === "file" ? "drive_files" : "drive_folders").delete().eq("id", item.id));
}
export async function toggleFavorite(item: Item, on: boolean) {
  const col = item.kind === "file" ? "file_id" : "folder_id";
  if (on) ok(await db.from("drive_favorites").insert({ user_id: await uid(), resource_type: item.kind, [col]: item.id }));
  else ok(await db.from("drive_favorites").delete().eq(col, item.id));
}
export async function touchOpened(id: string) {
  await db.from("drive_files").update({ last_opened_at: new Date().toISOString() }).eq("id", id);
}
export async function signedUrl(file: DriveFile, download = false) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 3600, download ? { download: file.name } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export async function shareWith(item: Item, email: string, permission: Permission) {
  const { data: target, error } = await db.rpc("drive_find_user", { _email: email });
  if (error) throw new Error(error.message);
  if (!target) throw new Error("Nenhuma conta Furry's Life com esse e-mail");
  const col = item.kind === "file" ? "file_id" : "folder_id";
  ok(await db.from("drive_shares").insert({ owner_id: await uid(), resource_type: item.kind, [col]: item.id, shared_with: target, shared_with_email: email.trim().toLowerCase(), permission }));
}
export async function unshare(id: string) { ok(await db.from("drive_shares").delete().eq("id", id)); }
export async function updateShare(id: string, permission: Permission) { ok(await db.from("drive_shares").update({ permission }).eq("id", id)); }

export function formatBytes(n: number) {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}
