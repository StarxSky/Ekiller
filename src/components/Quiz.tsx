import { useState, useCallback, useMemo } from 'react';
import type { Word } from '../types';

interface QuizProps {
  words: Word[];
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

type Phase = 'start' | 'playing' | 'feedback' | 'results';

export default function Quiz({ words }: QuizProps) {
  const [phase, setPhase] = useState<Phase>('start');
  const [queue, setQueue] = useState<Word[]>([]);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [options, setOptions] = useState<Word[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<'waiting' | 'correct' | 'wrong'>('waiting');
  const [stats, setStats] = useState<Map<string, WordStat>>(new Map());

  const filteredWords = useMemo(
    () => words.filter((w) => w.word && w.meaning),
    [words]
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
    const q = shuffle(filteredWords);
    setQueue(q.slice(1));
    setCurrentWord(q[0]);
    const dist = shuffle(q.slice(1, 4));
    setOptions(shuffle([q[0], ...dist]));
    setSelectedId(null);
    setAnswerState('waiting');
    setStats(new Map());
    setPhase('playing');
  }, [filteredWords]);

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

  if (filteredWords.length < 2) {
    return (
      <div className="quiz-empty">
        <h2>单词不足</h2>
        <p>至少需要 2 个单词才能开始学习，当前仅 {filteredWords.length} 个。</p>
      </div>
    );
  }

  if (phase === 'start') {
    return (
      <div className="quiz">
        <div className="quiz-start">
          <h2>准备好了吗？</h2>
          <p>共 {filteredWords.length} 个单词</p>
          <button className="btn btn-primary" onClick={startQuiz}>
            开始学习
          </button>
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
  const totalCount = filteredWords.length;
  const answeredCount = stats.size;

  return (
    <div className="quiz">
      <div className="quiz-progress">
        <span className="quiz-word-count">
          第 {answeredCount + 1} / {totalCount} 题
        </span>
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
