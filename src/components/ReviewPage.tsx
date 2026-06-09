import { useState, useRef, useCallback } from 'react';
import type { Word } from '../types';

interface ReviewPageProps {
  onStartReview: (words: Word[]) => void;
}

interface WordStat {
  word: Word;
  wrongCount: number;
}

interface ProgressData {
  version: 1;
  timestamp: string;
  stats: Array<{ word: Word; wrongCount: number }>;
}

export default function ReviewPage({ onStartReview }: ReviewPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [allStats, setAllStats] = useState<WordStat[] | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data: ProgressData = JSON.parse(reader.result as string);
        if (!data || data.version !== 1) throw new Error('无效的进度文件');
        const stats = data.stats.map((s) => ({ word: s.word, wrongCount: s.wrongCount }));
        if (stats.length === 0) {
          setError('该进度中没有学习记录');
          setAllStats(null);
        } else {
          setError(null);
          setAllStats(stats);
        }
      } catch {
        setError('导入失败：无效的进度文件');
        setAllStats(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const wrongStats = allStats?.filter((s) => s.wrongCount > 0) ?? [];

  return (
    <div className="review-page">
      <h2>错题复习</h2>
      <p className="review-desc">导入之前导出的学习进度文件，提取已学单词进行复习。</p>

      <button className="btn btn-primary" onClick={() => importRef.current?.click()}>
        导入进度文件
      </button>
      <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />

      {error && <p className="error-msg">{error}</p>}

      {allStats && (
        <div className="review-result">
          <div className="review-summary-cards">
            <div className="review-card" onClick={() => onStartReview(allStats.map((s) => s.word))}>
              <div className="review-card-num">{allStats.length}</div>
              <div className="review-card-label">已学单词</div>
            </div>
            {wrongStats.length > 0 && (
              <div className="review-card review-card-wrong" onClick={() => onStartReview(wrongStats.map((s) => s.word))}>
                <div className="review-card-num">{wrongStats.length}</div>
                <div className="review-card-label">错题</div>
              </div>
            )}
          </div>

          <div className="qr-wrong-list" style={{ marginTop: 16 }}>
            {allStats.map((s) => (
              <div key={s.word.id} className={`review-item${s.wrongCount > 0 ? ' review-item-wrong' : ''}`}>
                <span className="qr-wrong-word">{s.word.word}</span>
                <span className="qr-wrong-meaning">{s.word.meaning}</span>
                <span className="qr-wrong-count">{s.wrongCount > 0 ? `错误 ${s.wrongCount} 次` : '✓ 正确'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
