import { useState, useMemo } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/common';

interface SpellingListImportProps {
  existingWords: Set<string>; // Lowercase word texts already in bank
  onImport: (wordTexts: string[]) => void;
}

/**
 * Component for pasting and importing a spelling list
 * Supports comma-separated and newline-separated input
 */
export function SpellingListImport({
  existingWords,
  onImport,
}: SpellingListImportProps) {
  const [textValue, setTextValue] = useState('');

  // Parse text into words
  const parsedResult = useMemo(() => {
    if (!textValue.trim()) {
      return { words: [], duplicates: 0, invalid: 0 };
    }

    // Split by commas or newlines
    const rawWords = textValue
      .split(/[,\n]/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);

    // Deduplicate within the input
    const uniqueWords = [...new Set(rawWords)];

    // Validate words (basic: letters only, 2+ chars)
    const validWords: string[] = [];
    let invalidCount = 0;
    for (const word of uniqueWords) {
      if (/^[a-z]+$/.test(word) && word.length >= 2) {
        validWords.push(word);
      } else {
        invalidCount++;
      }
    }

    // Check for duplicates in existing bank
    const newWords = validWords.filter(w => !existingWords.has(w));
    const duplicateCount = validWords.length - newWords.length;

    return {
      words: newWords,
      duplicates: duplicateCount,
      invalid: invalidCount,
    };
  }, [textValue, existingWords]);

  const handleImport = () => {
    if (parsedResult.words.length > 0) {
      onImport(parsedResult.words);
      setTextValue('');
    }
  };

  const hasContent = textValue.trim().length > 0;
  const hasNewWords = parsedResult.words.length > 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span>or import a list</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <textarea
        value={textValue}
        onChange={e => setTextValue(e.target.value)}
        placeholder="Paste words here (one per line or comma-separated)&#10;&#10;Example:&#10;elephant, giraffe, zebra&#10;or&#10;elephant&#10;giraffe&#10;zebra"
        className="w-full h-32 px-4 py-3 border border-gray-200 rounded-lg resize-none
                 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none
                 text-sm font-mono"
      />

      {hasContent && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {hasNewWords ? (
              <span className="text-green-700 bg-green-50 px-2 py-1 rounded">
                Found {parsedResult.words.length} new{' '}
                {parsedResult.words.length === 1 ? 'word' : 'words'}
              </span>
            ) : (
              <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                <AlertCircle size={14} />
                No new words to add
              </span>
            )}
            {parsedResult.duplicates > 0 && (
              <span className="text-gray-500">
                ({parsedResult.duplicates} already in bank)
              </span>
            )}
            {parsedResult.invalid > 0 && (
              <span className="text-amber-600">
                ({parsedResult.invalid} invalid)
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={!hasNewWords}
            className="flex items-center gap-2"
          >
            <Upload size={16} />
            Import {hasNewWords ? parsedResult.words.length : ''}{' '}
            {parsedResult.words.length === 1 ? 'Word' : 'Words'}
          </Button>
        </div>
      )}

      {hasNewWords && parsedResult.words.length <= 20 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {parsedResult.words.map(word => (
            <span
              key={word}
              className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
            >
              {word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
