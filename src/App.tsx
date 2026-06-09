import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import type { Word } from './types';
import { useWords } from './hooks/useWords';
import { useFileSync } from './hooks/useFileSync';
import Quiz from './components/Quiz';
import WordManager from './components/WordManager';

import ReviewPage from './components/ReviewPage';

type Page = 'quiz' | 'manage' | 'review';

function exportJSON(words: Word[]) {
  const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'words.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(): Promise<Word[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        resolve(Array.isArray(parsed) ? (parsed as Word[]) : null);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

async function fetchShippedWords(): Promise<Word[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}words.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('words.json 格式错误，应为数组');
  return data as Word[];
}

function App() {
  const [page, setPage] = useState<Page>('quiz');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewWords, setReviewWords] = useState<Word[] | undefined>(undefined);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const {
    dirHandle,
    dirName,
    syncing,
    handleReady,
    selectDirectory,
    disconnect,
    readWords,
    writeWords,
    supportsFileSystemAccess,
    isAbortError,
  } = useFileSync();

  const { words, addWord, removeWord, updateWord, replaceWords } = useWords([]);

  const shippedRef = useRef<Word[]>([]);
  const dirRef = useRef<FileSystemDirectoryHandle | null>(null);
  const prevWords = useRef(words);
  const [shippedReady, setShippedReady] = useState(false);

  useEffect(() => {
    fetchShippedWords()
      .then((data) => {
        shippedRef.current = data;
        setShippedReady(true);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '加载 words.json 失败');
        setShippedReady(true);
      });
  }, []);

  useEffect(() => {
    if (!handleReady || !shippedReady) return;

    if (dirHandle) {
      dirRef.current = dirHandle;
      readWords(dirHandle).then((fileWords) => {
        if (fileWords && fileWords.length > 0) {
          replaceWords(fileWords);
        } else {
          replaceWords(shippedRef.current);
          writeWords(dirHandle, shippedRef.current);
        }
        setLoading(false);
      });
    } else {
      replaceWords(shippedRef.current);
      setLoading(false);
    }
  }, [handleReady, shippedReady, dirHandle, readWords, writeWords, replaceWords]);

  useEffect(() => {
    if (loading || !dirRef.current) return;
    if (prevWords.current === words) return;
    prevWords.current = words;
    writeWords(dirRef.current, words).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : '写入文件失败');
    });
  }, [words, loading, writeWords]);

  const handleSelectDir = useCallback(async () => {
    setError(null);
    try {
      const handle = await selectDirectory();
      const fileWords = await readWords(handle);
      if (fileWords && fileWords.length > 0) {
        replaceWords(fileWords);
      } else {
        const shipped = shippedRef.current;
        replaceWords(shipped);
        await writeWords(handle, shipped);
      }
      dirRef.current = handle;
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : '操作失败');
    }
  }, [selectDirectory, readWords, writeWords, replaceWords, isAbortError]);

  const handleReset = useCallback(async () => {
    try {
      const shipped = shippedRef.current.length > 0
        ? shippedRef.current
        : await fetchShippedWords();
      shippedRef.current = shipped;
      replaceWords([...shipped]);
      if (dirRef.current) await writeWords(dirRef.current, shipped);
    } catch {
      setError('恢复默认失败');
    }
  }, [replaceWords, writeWords]);

  const handleExport = useCallback(() => {
    exportJSON(words);
  }, [words]);

  const handleImport = useCallback(async () => {
    const imported = await importJSON();
    if (imported && imported.length > 0) {
      replaceWords(imported);
    } else {
      setError('导入失败：文件格式不正确');
    }
  }, [replaceWords]);

  if (loading) {
    return (
      <div className="app">
        <div className="app-center">
          <div className="loading-spinner" />
          <p className="loading-text">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <h1>背单词 </h1>
          {dirName ? (
            <span className="app-dir-badge">
              <span className="sync-dot" />
              {dirName}/words.json
              {syncing && <span className="sync-spinner" />}
            </span>
          ) : (
            <span className="app-dir-badge app-dir-badge--offline">
              Beta
            </span>
          )}
        </div>
        <nav className="app-nav">
          <button
            className={`btn btn-nav ${page === 'quiz' ? 'active' : ''}`}
            onClick={() => { setReviewWords(undefined); setPage('quiz'); }}
          >
            学习
          </button>
          <button
            className={`btn btn-nav ${page === 'manage' ? 'active' : ''}`}
            onClick={() => setPage('manage')}
          >
            管理单词
          </button>
          <button
            className={`btn btn-nav ${page === 'review' ? 'active' : ''}`}
            onClick={() => { setReviewWords(undefined); setPage('review'); }}
          >
            错题复习
          </button>
          <button className="btn-icon" onClick={toggleTheme} title={darkMode ? '切换亮色模式' : '切换暗色模式'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </nav>
      </header>

      {error && (
        <div className="app-banner">
          {error}
          <button className="btn btn-small" onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      <main className="app-main">
        {page === 'quiz' ? (
          <Quiz words={words} reviewWords={reviewWords} />
        ) : page === 'review' ? (
          <ReviewPage
            onStartReview={(w) => {
              setReviewWords(w);
              setPage('quiz');
            }}
          />
        ) : (
          <WordManager
            words={words}
            onAdd={addWord}
            onRemove={removeWord}
            onUpdate={updateWord}
            onReset={handleReset}
            dirName={dirName}
            syncing={syncing}
            onSelectDirectory={handleSelectDir}
            onDisconnect={disconnect}
            onExport={handleExport}
            onImport={handleImport}
            supportsFileSystemAccess={supportsFileSystemAccess}
          />
        )}
      </main>

      <footer className="app-footer">
        Copyright &copy; Author : Hongsheng Xing &nbsp; Email: <a href="mailto:starxsky@outlook.com">starxsky@outlook.com</a>
      </footer>
    </div>
  );
}

export default App;
