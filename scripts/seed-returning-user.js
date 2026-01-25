/**
 * Seed localStorage with practice data for the "Returning User" QA test account.
 *
 * Usage with agent-browser (after logging in as claude-qa-returning@testmail.dev):
 *   agent-browser eval "$(cat scripts/seed-returning-user.js)"
 *
 * Or paste directly into browser console after login.
 *
 * This creates realistic practice history:
 * - 30 words with varying mastery levels (8 mastered, 10 reviewing, 12 learning)
 * - 5 words due for review today
 * - 13 games played, 11 wins, 4-day streak
 * - 2 earned achievements (First Steps, Quick Speller)
 */
(() => {
  // Find the child's word bank key in localStorage
  const wbKeyMatch = Object.keys(localStorage).find(k => k.includes('word-bank-'));
  if (!wbKeyMatch) {
    return 'ERROR: No word bank found. Complete onboarding first (select profile + grade level).';
  }

  const childId = wbKeyMatch.replace('alice-spelling-run-word-bank-', '');
  const wbKey = `alice-spelling-run-word-bank-${childId}`;
  const statsKey = `alice-spelling-run-statistics-${childId}`;

  const wb = JSON.parse(localStorage.getItem(wbKey));
  if (!wb || !wb.words || wb.words.length === 0) {
    return 'ERROR: Word bank is empty. Complete calibration first.';
  }

  const now = new Date();

  function daysAgo(n) {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  function makeAttempts(word, correct, incorrect, startDay) {
    const attempts = [];
    for (let i = 0; i < incorrect; i++) {
      attempts.push({
        id: crypto.randomUUID(),
        timestamp: daysAgo(startDay - i),
        wasCorrect: false,
        typedText: word.slice(0, -1) + 'x',
        mode: 'meadow',
      });
    }
    for (let i = 0; i < correct; i++) {
      attempts.push({
        id: crypto.randomUUID(),
        timestamp: daysAgo(startDay - incorrect - i),
        wasCorrect: true,
        typedText: word,
        mode: i % 3 === 0 ? 'savannah-quick' : 'meadow',
        timeMs: 2000 + Math.floor(Math.random() * 5000),
      });
    }
    return attempts;
  }

  const words = wb.words;
  let modified = 0;

  // 8 mastered words (level 5)
  for (let i = 0; i < 8 && i < words.length; i++) {
    words[i].masteryLevel = 5;
    words[i].correctStreak = 5;
    words[i].timesUsed = 8;
    words[i].timesCorrect = 7;
    words[i].introducedAt = daysAgo(14);
    words[i].lastAttemptAt = daysAgo(1);
    words[i].nextReviewAt = daysAgo(-25);
    words[i].attemptHistory = makeAttempts(words[i].text, 7, 1, 14);
    modified++;
  }

  // 10 reviewing words (level 3-4)
  for (let i = 8; i < 18 && i < words.length; i++) {
    const level = i < 13 ? 4 : 3;
    words[i].masteryLevel = level;
    words[i].correctStreak = level;
    words[i].timesUsed = 5;
    words[i].timesCorrect = 4;
    words[i].introducedAt = daysAgo(10);
    words[i].lastAttemptAt = daysAgo(2);
    words[i].nextReviewAt = daysAgo(-1);
    words[i].attemptHistory = makeAttempts(words[i].text, 4, 1, 10);
    modified++;
  }

  // 12 learning words (level 0-2)
  for (let i = 18; i < 30 && i < words.length; i++) {
    const level = i < 22 ? 2 : (i < 26 ? 1 : 0);
    words[i].masteryLevel = level;
    words[i].correctStreak = level;
    words[i].timesUsed = 3;
    words[i].timesCorrect = level;
    words[i].introducedAt = daysAgo(5);
    words[i].lastAttemptAt = daysAgo(1);
    words[i].nextReviewAt = daysAgo(0);
    words[i].attemptHistory = makeAttempts(words[i].text, level, 3 - level, 5);
    modified++;
  }

  // 5 words due today
  for (let i = 18; i < 23 && i < words.length; i++) {
    words[i].nextReviewAt = daysAgo(1);
  }

  wb.lastUpdated = now.toISOString();
  wb.lastNewWordDate = now.toISOString().split('T')[0];
  wb.newWordsIntroducedToday = 2;
  localStorage.setItem(wbKey, JSON.stringify(wb));

  // Seed statistics
  const stats = {
    modeStats: {
      meadow: {
        totalGamesPlayed: 8, totalWins: 8, totalWordsAttempted: 40, totalWordsCorrect: 32,
        trophyCounts: { platinum: 0, gold: 0, silver: 0, bronze: 0, participant: 0 },
        gameHistory: [], streakCurrent: 4, streakBest: 4,
      },
      savannah: {
        totalGamesPlayed: 5, totalWins: 3, totalWordsAttempted: 50, totalWordsCorrect: 38,
        trophyCounts: { platinum: 1, gold: 1, silver: 1, bronze: 0, participant: 2 },
        gameHistory: [], streakCurrent: 2, streakBest: 3,
      },
      wildlands: {
        totalGamesPlayed: 0, totalWins: 0, totalWordsAttempted: 0, totalWordsCorrect: 0,
        trophyCounts: { platinum: 0, gold: 0, silver: 0, bronze: 0, participant: 0 },
        gameHistory: [], streakCurrent: 0, streakBest: 0,
      },
    },
    wordAccuracy: {},
    firstCorrectDates: {},
    personalBests: {},
    errorPatterns: {},
    totalGamesPlayed: 13,
    totalWins: 11,
    totalWordsAttempted: 90,
    totalWordsCorrect: 70,
    trophyCounts: { platinum: 1, gold: 1, silver: 1, bronze: 0, participant: 2 },
    gameHistory: [],
    streakCurrent: 4,
    streakBest: 4,
  };
  localStorage.setItem(statsKey, JSON.stringify(stats));

  return `Seeded ${modified} words + statistics for child ${childId}. Reload the page to see changes.`;
})();
