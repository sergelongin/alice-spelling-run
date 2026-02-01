import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, BookX } from 'lucide-react';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import type { WordProgress, WordAttemptModel } from '@/db/models';
import type { ChildProfile } from '@/types/auth';
import type { AttentionItem } from '@/types/parent';
import type { WordAttempt } from '@/types';

interface AttentionNeededListProps {
  children: ChildProfile[];
}

/**
 * Build a map of word_text -> WordAttempt[] from attempt records, grouped by child
 * Returns a nested map: childId -> wordText -> WordAttempt[]
 */
function buildAttemptsMapByChild(attempts: WordAttemptModel[]): Map<string, Map<string, WordAttempt[]>> {
  const childMap = new Map<string, Map<string, WordAttempt[]>>();
  for (const attempt of attempts) {
    if (!childMap.has(attempt.childId)) {
      childMap.set(attempt.childId, new Map());
    }
    const wordMap = childMap.get(attempt.childId)!;
    const key = attempt.wordText.toLowerCase();
    if (!wordMap.has(key)) {
      wordMap.set(key, []);
    }
    wordMap.get(key)!.push({
      id: attempt.clientAttemptId,
      timestamp: attempt.attemptedAt,
      wasCorrect: attempt.wasCorrect,
      typedText: attempt.typedText,
      mode: attempt.mode,
      timeMs: attempt.timeMs,
      attemptNumber: attempt.attemptNumber,
    });
  }
  return childMap;
}

/**
 * List of issues that need parent attention across all children
 */
export function AttentionNeededList({ children }: AttentionNeededListProps) {
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [wordProgressRecords, setWordProgressRecords] = useState<WordProgress[]>([]);
  const [wordAttemptRecords, setWordAttemptRecords] = useState<WordAttemptModel[]>([]);

  // Subscribe to word progress and word attempts for all children
  useEffect(() => {
    if (children.length === 0) {
      setWordProgressRecords([]);
      setWordAttemptRecords([]);
      return;
    }

    const childIds = children.map(c => c.id);
    const subscriptions: { unsubscribe: () => void }[] = [];

    // Word Progress subscription
    const wpCollection = database.get<WordProgress>('word_progress');
    const wpSubscription = wpCollection
      .query(Q.where('child_id', Q.oneOf(childIds)))
      .observe()
      .subscribe(records => {
        setWordProgressRecords(records);
      });
    subscriptions.push(wpSubscription);

    // Word Attempts subscription (for attemptHistory data)
    const waCollection = database.get<WordAttemptModel>('word_attempts');
    const waSubscription = waCollection
      .query(Q.where('child_id', Q.oneOf(childIds)))
      .observe()
      .subscribe(records => {
        setWordAttemptRecords(records);
      });
    subscriptions.push(waSubscription);

    return () => {
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    };
  }, [children]);

  // Compute attention items when data changes
  useEffect(() => {
    if (children.length === 0) {
      setAttentionItems([]);
      return;
    }

    const items: AttentionItem[] = [];

    // Build attempts map by child
    const attemptsByChild = buildAttemptsMapByChild(wordAttemptRecords);

    // Group word progress records by child
    const recordsByChild = new Map<string, WordProgress[]>();
    for (const record of wordProgressRecords) {
      const existing = recordsByChild.get(record.childId) || [];
      existing.push(record);
      recordsByChild.set(record.childId, existing);
    }

    // Analyze each child
    for (const child of children) {
      const childRecords = recordsByChild.get(child.id) || [];
      const childAttemptsMap = attemptsByChild.get(child.id) || new Map<string, WordAttempt[]>();

      // Calculate last activity date
      let lastActivityTs: number | null = null;
      for (const wp of childRecords) {
        if (wp.lastAttemptAtRaw && (!lastActivityTs || wp.lastAttemptAtRaw > lastActivityTs)) {
          lastActivityTs = wp.lastAttemptAtRaw;
        }
      }

      // Calculate days since activity
      let daysSince: number | null = null;
      if (lastActivityTs) {
        const diffMs = Date.now() - lastActivityTs;
        daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      // Find struggling words (low accuracy, has been attempted)
      const strugglingWords: string[] = [];
      for (const wp of childRecords) {
        if (wp.isActive === false) continue;
        // Get attempts from normalized table, fall back to JSONB field
        const attempts = childAttemptsMap.get(wp.wordText.toLowerCase()) || wp.attemptHistory || [];
        if (attempts.length < 2) continue;
        const correctCount = attempts.filter(a => a.wasCorrect).length;
        const accuracy = attempts.length > 0 ? (correctCount / attempts.length) * 100 : 100;
        if (accuracy < 60) {
          strugglingWords.push(wp.wordText);
        }
      }

      // Check for inactivity
      if (daysSince !== null && daysSince >= 3) {
        items.push({
          type: 'inactivity',
          childId: child.id,
          childName: child.name,
          message: `${child.name} hasn't practiced in ${daysSince} day${daysSince === 1 ? '' : 's'}`,
          severity: daysSince >= 7 ? 'alert' : 'warning',
        });
      }

      // Check for struggling words
      if (strugglingWords.length >= 3) {
        const wordList = strugglingWords.slice(0, 3).map(w => `"${w}"`).join(', ');
        const moreCount = strugglingWords.length - 3;
        items.push({
          type: 'struggling-words',
          childId: child.id,
          childName: child.name,
          message: `${child.name} is struggling with ${wordList}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
          severity: strugglingWords.length >= 5 ? 'alert' : 'warning',
        });
      }
    }

    // Sort by severity (alerts first)
    items.sort((a, b) => {
      if (a.severity === 'alert' && b.severity !== 'alert') return -1;
      if (a.severity !== 'alert' && b.severity === 'alert') return 1;
      return 0;
    });

    setAttentionItems(items);
  }, [children, wordProgressRecords, wordAttemptRecords]);

  if (attentionItems.length === 0) {
    return (
      <div className="bg-green-50 rounded-xl p-5 border border-green-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-xl">🌟</span>
          </div>
          <div>
            <h3 className="font-semibold text-green-800">All Good!</h3>
            <p className="text-sm text-green-600">Everyone is on track with their learning.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-500" />
        Needs Attention
      </h2>

      <div className="space-y-3">
        {attentionItems.map((item, index) => (
          <div
            key={`${item.childId}-${item.type}-${index}`}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              item.severity === 'alert' ? 'bg-red-50' : 'bg-amber-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.severity === 'alert' ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              {item.type === 'inactivity' ? (
                <Clock size={16} className={item.severity === 'alert' ? 'text-red-600' : 'text-amber-600'} />
              ) : (
                <BookX size={16} className={item.severity === 'alert' ? 'text-red-600' : 'text-amber-600'} />
              )}
            </div>
            <p className={`text-sm ${item.severity === 'alert' ? 'text-red-700' : 'text-amber-700'}`}>
              {item.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
