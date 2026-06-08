import { useState } from 'react';
import type { Word } from '../types';

interface WordManagerProps {
  words: Word[];
  onAdd: (word: string, meaning: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, word: string, meaning: string) => void;
  onReset: () => void;
  dirName: string;
  syncing: boolean;
  onSelectDirectory: () => void;
  onDisconnect: () => void;
  onExport: () => void;
  onImport: () => void;
  supportsFileSystemAccess: boolean;
}

export default function WordManager({
  words,
  onAdd,
  onRemove,
  onUpdate,
  onReset,
  dirName,
  syncing,
  onSelectDirectory,
  onDisconnect,
  onExport,
  onImport,
  supportsFileSystemAccess,
}: WordManagerProps) {
  const [wordInput, setWordInput] = useState('');
  const [meaningInput, setMeaningInput] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState('');
  const [editMeaning, setEditMeaning] = useState('');

  const handleAdd = () => {
    const w = wordInput.trim();
    const m = meaningInput.trim();
    if (!w || !m) return;
    onAdd(w, m);
    setWordInput('');
    setMeaningInput('');
  };

  const handleEditStart = (w: Word) => {
    setEditId(w.id);
    setEditWord(w.word);
    setEditMeaning(w.meaning);
  };

  const handleEditSave = () => {
    if (!editId) return;
    const w = editWord.trim();
    const m = editMeaning.trim();
    if (!w || !m) return;
    onUpdate(editId, w, m);
    setEditId(null);
  };

  const handleReset = () => {
    if (window.confirm('恢复为项目自带的默认单词列表，当前单词将丢失。确定吗？')) {
      onReset();
    }
  };

  return (
    <div className="word-manager">
      <div className="wm-header">
        <h2>单词管理</h2>
        <button className="btn btn-danger-outline" onClick={handleReset}>
          恢复默认
        </button>
      </div>

      <div className="wm-add">
        <input
          value={wordInput}
          onChange={(e) => setWordInput(e.target.value)}
          placeholder="输入英文单词"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          value={meaningInput}
          onChange={(e) => setMeaningInput(e.target.value)}
          placeholder="输入中文释义"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary" onClick={handleAdd}>
          添加
        </button>
      </div>

      <div className="wm-list">
        {words.length === 0 && <p className="wm-empty">暂无单词，请添加。</p>}
        {words.map((w) => (
          <div key={w.id} className="wm-item">
            {editId === w.id ? (
              <div className="wm-edit">
                <input
                  value={editWord}
                  onChange={(e) => setEditWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                />
                <input
                  value={editMeaning}
                  onChange={(e) => setEditMeaning(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                />
                <button className="btn btn-small btn-primary" onClick={handleEditSave}>
                  保存
                </button>
                <button className="btn btn-small" onClick={() => setEditId(null)}>
                  取消
                </button>
              </div>
            ) : (
              <>
                <div className="wm-word">
                  <span className="wm-en">{w.word}</span>
                  <span className="wm-zh">{w.meaning}</span>
                </div>
                <div className="wm-actions">
                  <button className="btn btn-small" onClick={() => handleEditStart(w)}>
                    编辑
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => onRemove(w.id)}>
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="wm-file-sync">
        <h3>本地存储</h3>

        {supportsFileSystemAccess ? (
          dirName ? (
            <div className="wm-sync-info">
              <div className="wm-sync-status">
                <span className="sync-dot" />
                保存至 <code>{dirName}/words.json</code>
                {syncing && <span className="sync-spinner" />}
              </div>
              <button className="btn btn-small btn-danger" onClick={onDisconnect}>
                更换目录
              </button>
            </div>
          ) : (
            <div className="wm-sync-info">
              <p className="wm-sync-desc">
                选择本地目录，所有单词自动保存到 <code>words.json</code>
              </p>
              <button className="btn btn-primary" onClick={onSelectDirectory}>
                选择存储目录
              </button>
            </div>
          )
        ) : (
          <div className="wm-sync-info">
            <p className="wm-sync-desc">
              当前浏览器不支持自动同步，请手动导入/导出
            </p>
          </div>
        )}

        <div className="wm-io-actions">
          <button className="btn" onClick={onExport}>
            导出 JSON
          </button>
          <button className="btn" onClick={onImport}>
            导入 JSON
          </button>
        </div>
      </div>
    </div>
  );
}
