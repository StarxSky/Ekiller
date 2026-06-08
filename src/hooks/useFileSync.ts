import { useState, useEffect, useCallback } from 'react';
import type { Word } from '../types';

const DB_NAME = 'vocab-file-sync';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'dir-handle';
const FILE_NAME = 'words.json';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const opts = { mode: 'readwrite' as FileSystemPermissionMode };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

const supportsFileSystemAccess = (): boolean =>
  'showDirectoryPicker' in window &&
  typeof window.showDirectoryPicker === 'function';

export function useFileSync() {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [handleReady, setHandleReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHandle().then((handle) => {
      if (handle) {
        setDirHandle(handle);
        setDirName(handle.name);
      }
      setHandleReady(true);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const selectDirectory = useCallback(async (): Promise<FileSystemDirectoryHandle> => {
    setError(null);
    if (!supportsFileSystemAccess()) {
      throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge');
    }
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker();
    } catch (err) {
      if (isAbortError(err)) throw err;
      throw new Error('选择目录时出错');
    }
    const ok = await verifyPermission(handle);
    if (!ok) throw new Error('没有读写权限，请允许应用访问该目录');
    await saveHandle(handle);
    setDirHandle(handle);
    setDirName(handle.name);
    return handle;
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    await removeHandle();
    setDirHandle(null);
    setDirName('');
  }, []);

  const readWords = useCallback(
    async (handle: FileSystemDirectoryHandle): Promise<Word[] | null> => {
      try {
        const fileHandle = await handle.getFileHandle(FILE_NAME);
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!text.trim()) return null;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return null;
        return parsed as Word[];
      } catch {
        return null;
      }
    },
    []
  );

  const writeWords = useCallback(
    async (handle: FileSystemDirectoryHandle, words: Word[]) => {
      const ok = await verifyPermission(handle);
      if (!ok) throw new Error('没有写入权限，请重新选择目录');
      setSyncing(true);
      try {
        const fileHandle = await handle.getFileHandle(FILE_NAME, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(words, null, 2));
        await writable.close();
      } finally {
        setSyncing(false);
      }
    },
    []
  );

  return {
    dirHandle,
    dirName,
    syncing,
    handleReady,
    error,
    setError,
    clearError,
    selectDirectory,
    disconnect,
    readWords,
    writeWords,
    supportsFileSystemAccess: supportsFileSystemAccess(),
    isAbortError,
  };
}
