import { useState, useCallback } from 'react';
import type { Word } from '../types';

export function useWords(initialWords: Word[]) {
  const [words, setWords] = useState<Word[]>(initialWords);

  const addWord = useCallback((word: string, meaning: string) => {
    const newWord: Word = {
      id: crypto.randomUUID(),
      word: word.trim(),
      meaning: meaning.trim(),
    };
    setWords((prev) => [...prev, newWord]);
  }, []);

  const removeWord = useCallback((id: string) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const updateWord = useCallback((id: string, word: string, meaning: string) => {
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, word: word.trim(), meaning: meaning.trim() } : w))
    );
  }, []);

  const replaceWords = useCallback((next: Word[]) => {
    setWords(next);
  }, []);

  return { words, addWord, removeWord, updateWord, replaceWords };
}
