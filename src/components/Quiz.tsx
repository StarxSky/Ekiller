import { useState, useCallback, useMemo, useRef } from 'react';
import type { Word } from '../types';

interface QuizProps {
  words: Word[];
  reviewWords?: Word[];
}

interface WordStat {
  word: Word;
  wrongCount: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildWeightedQueue(words: Word[]): Word[] {
  const queue: Word[] = [];
  for (const w of words) {
    const weight = Math.max(1, Math.ceil((w.freq ?? 3) / 3));
    for (let i = 0; i < weight; i++) {
      queue.push(w);
    }
  }
  return shuffle(queue);
}

type Phase = 'start' | 'playing' | 'feedback' | 'results';

function exportWrongWords(wrongList: WordStat[]) {
  const words = wrongList.map((s) => s.word);
  const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `wrong-words-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

interface ProgressData {
  version: 1;
  timestamp: string;
  queue: Word[];
  queueIndex: number;
  queueTotal: number;
  currentWord: Word | null;
  stats: Array<{ word: Word; wrongCount: number }>;
}

function exportProgress(
  queue: Word[],
  queueIndex: number,
  queueTotal: number,
  currentWord: Word | null,
  stats: Map<string, WordStat>
) {
  const data: ProgressData = {
    version: 1,
    timestamp: new Date().toISOString(),
    queue,
    queueIndex,
    queueTotal,
    currentWord,
    stats: Array.from(stats.values()).map((s) => ({
      word: s.word,
      wrongCount: s.wrongCount,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quiz-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Quiz({ words, reviewWords }: QuizProps) {
  const [phase, setPhase] = useState<Phase>('start');
  const [queue, setQueue] = useState<Word[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [options, setOptions] = useState<Word[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<'waiting' | 'correct' | 'wrong'>('waiting');
  const [stats, setStats] = useState<Map<string, WordStat>>(new Map());
  const importRef = useRef<HTMLInputElement>(null);

  const filteredWords = useMemo(
    () => words.filter((w) => w.word && w.meaning),
    [words]
  );

  const quizPool = useMemo(
    () => reviewWords ?? filteredWords,
    [reviewWords, filteredWords]
  );

  const correctCount = useMemo(() => {
    let c = 0;
    for (const s of stats.values()) {
      if (s.wrongCount === 0) c++;
    }
    return c;
  }, [stats]);

  const wrongList = useMemo(() => {
    const arr: WordStat[] = [];
    for (const s of stats.values()) {
      if (s.wrongCount > 0) arr.push(s);
    }
    return arr;
  }, [stats]);

  const startQuiz = useCallback(() => {
    const q = buildWeightedQueue(quizPool);
    setQueueTotal(q.length);
    setQueue(q.slice(1));
    setQueueIndex(0);
    setCurrentWord(q[0]);
    const others = filteredWords.filter((w) => w.id !== q[0].id);
    const dist = shuffle(others).slice(0, 3);
    setOptions(shuffle([q[0], ...dist]));
    setSelectedId(null);
    setAnswerState('waiting');
    setStats(new Map());
    setPhase('playing');
  }, [quizPool, filteredWords]);

  const nextWord = useCallback(() => {
    if (queue.length === 0) {
      setPhase('results');
      return;
    }
    const next = queue[0];
    const rest = queue.slice(1);
    const others = filteredWords.filter((w) => w.id !== next.id);
    const dist = shuffle(others).slice(0, 3);
    setCurrentWord(next);
    setOptions(shuffle([next, ...dist]));
    setQueue(rest);
    setQueueIndex((prev) => prev + 1);
    setSelectedId(null);
    setAnswerState('waiting');
    setPhase('playing');
  }, [queue, filteredWords]);

  const handleSelect = useCallback(
    (id: string) => {
      if (answerState !== 'waiting' || !currentWord) return;
      setSelectedId(id);
      const correct = id === currentWord.id;
      setAnswerState(correct ? 'correct' : 'wrong');

      setStats((prev) => {
        const next = new Map(prev);
        const existing = next.get(currentWord.id);
        if (existing) {
          next.set(currentWord.id, {
            ...existing,
            wrongCount: correct ? existing.wrongCount : existing.wrongCount + 1,
          });
        } else {
          next.set(currentWord.id, {
            word: currentWord,
            wrongCount: correct ? 0 : 1,
          });
        }
        return next;
      });
    },
    [answerState, currentWord]
  );

  const handleImportProgress = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data: ProgressData = JSON.parse(reader.result as string);
        if (!data || data.version !== 1) throw new Error('无效的进度文件');
        setQueue(data.queue);
        setQueueIndex(data.queueIndex);
        setQueueTotal(data.queueTotal);
        setCurrentWord(data.currentWord);
        setSelectedId(null);
        setAnswerState('waiting');
        setStats(new Map(data.stats.map((s) => [s.word.id, { word: s.word, wrongCount: s.wrongCount }])));
        if (data.currentWord) {
          const others = words.filter((w) => w.word && w.meaning && w.id !== data.currentWord!.id);
          const dist = shuffle(others).slice(0, 3);
          setOptions(shuffle([data.currentWord, ...dist]));
        }
        setPhase('playing');
      } catch {
        alert('导入失败：无效的进度文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [words]);

  if (quizPool.length < 2) {
    return (
      <div className="quiz-empty">
        <h2>单词不足</h2>
        <p>至少需要 2 个单词才能开始学习，当前仅 {quizPool.length} 个。</p>
      </div>
    );
  }

  if (phase === 'start') {
    const totalWeighted = quizPool.reduce(
      (sum, w) => sum + Math.max(1, Math.ceil((w.freq ?? 3) / 3)),
      0
    );
    return (
      <div className="quiz">
        <div className="quiz-start">
          <h2>{reviewWords ? '错题复习' : '准备好了吗？'}</h2>
          <p>{quizPool.length} 个单词 · 共 {totalWeighted} 题{!reviewWords && '（高频词出现更频繁）'}</p>
          <button className="btn btn-primary" onClick={startQuiz}>
            开始{reviewWords ? '复习' : '学习'}
          </button>
          <button className="btn" onClick={() => importRef.current?.click()} style={{ marginTop: 8 }}>
            导入进度
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportProgress} style={{ display: 'none' }} />
        </div>
      </div>
    );
  }

  if (phase === 'results') {
    const total = stats.size;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    return (
      <div className="quiz">
        <div className="quiz-results">
          <div className="qr-card">
            <div className="qr-score">{accuracy}%</div>
            <div className="qr-label">正确率</div>
            <div className="qr-summary">
              {correctCount} / {total} 词正确
            </div>
          </div>

          {wrongList.length > 0 && (
            <div className="qr-wrong-section">
              <h3>需要复习的单词 ({wrongList.length})</h3>
              <div className="qr-wrong-list">
                {wrongList.map((s) => (
                  <div key={s.word.id} className="qr-wrong-item">
                    <span className="qr-wrong-word">{s.word.word}</span>
                    <span className="qr-wrong-meaning">{s.word.meaning}</span>
                    <span className="qr-wrong-count">错误 {s.wrongCount} 次</span>
                  </div>
                ))}
              </div>
              <button className="btn" onClick={() => exportWrongWords(wrongList)} style={{ marginTop: 12 }}>
                导出错题
              </button>
            </div>
          )}

          {wrongList.length === 0 && (
            <div className="qr-perfect">
              全部正确！太棒了 🎉
            </div>
          )}

          <button className="btn btn-primary" onClick={startQuiz}>
            重新学习
          </button>
        </div>
      </div>
    );
  }

  // playing / feedback
  const answeredCount = stats.size;

  return (
    <div className="quiz">
      <div className="quiz-progress">
        <span className="quiz-word-count">
          第 {queueIndex + 1} / {queueTotal} 题
        </span>
        <span className="quiz-word-count" style={{ marginLeft: 12, opacity: 0.6 }}>
          · {answeredCount} 个单词已作答
        </span>
        {wrongList.length > 0 && (
          <button className="btn btn-small" onClick={() => exportWrongWords(wrongList)} style={{ marginLeft: 12 }}>
            错题 ({wrongList.length})
          </button>
        )}
        <button className="btn btn-small" onClick={() => exportProgress(queue, queueIndex, queueTotal, currentWord, stats)} style={{ marginLeft: 8 }}>
          导出进度
        </button>
      </div>

      <div className="quiz-word-display">
        <h2>{currentWord?.word}</h2>
      </div>

      <div className="quiz-options">
        {options.map((opt) => {
          let cls = 'btn btn-option';
          if (answerState !== 'waiting' && opt.id === currentWord?.id) cls += ' correct';
          if (answerState !== 'waiting' && opt.id === selectedId && opt.id !== currentWord?.id) cls += ' wrong';
          if (selectedId === opt.id) cls += ' selected';

          return (
            <button
              key={opt.id}
              className={cls}
              onClick={() => handleSelect(opt.id)}
              disabled={answerState !== 'waiting'}
            >
              {opt.meaning}
            </button>
          );
        })}
      </div>

      {answerState !== 'waiting' && (
        <div className={`quiz-feedback ${answerState}`}>
          {answerState === 'correct' ? '✅ 回答正确！' : '❌ 回答错误'}
          <button className="btn btn-primary" onClick={nextWord}>
            {queue.length === 0 ? '查看结果' : '下一题'}
          </button>
        </div>
      )}
    </div>
  );
}
