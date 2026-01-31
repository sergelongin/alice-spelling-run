/**
 * Deduplication Script for Alice's Game Sessions
 *
 * This script removes duplicate game sessions caused by React StrictMode
 * double-mount triggering recordGame() twice per actual game.
 *
 * Run this in browser DevTools console after signing in as Alice's parent.
 *
 * Usage:
 * 1. npm run dev
 * 2. Sign in as Alice's parent
 * 3. Open DevTools → Console
 * 4. Paste this entire script and press Enter
 * 5. Review the output and confirm deletion when prompted
 */

(async function deduplicateSessions() {
  // Alice's child_id - update this if different
  const ALICE_CHILD_ID = 'd7fc0f60-671b-4b3c-9992-16f351e96b65';

  // Time window to consider sessions as duplicates (in milliseconds)
  const DUPLICATE_WINDOW_MS = 10000; // 10 seconds

  console.log('🔍 Opening WatermelonDB...');

  // Access the database through the global window object
  // The app exposes this via src/db/index.ts in development mode
  const db = window.__watermelondb;

  if (!db) {
    console.error('❌ WatermelonDB not found. Make sure you are signed in and the app is loaded.');
    console.log('💡 Try refreshing the page and running the script again.');
    return;
  }

  console.log('📊 Fetching all game sessions for Alice...');

  // Query game_sessions collection
  const sessionsCollection = db.get('game_sessions');
  const allSessions = await sessionsCollection
    .query()
    .fetch();

  // Filter to Alice's sessions
  const aliceSessions = allSessions.filter(s => s.childId === ALICE_CHILD_ID);

  console.log(`Found ${aliceSessions.length} total sessions for Alice`);

  if (aliceSessions.length === 0) {
    console.log('✅ No sessions found. Nothing to deduplicate.');
    return;
  }

  // Sort by created_at timestamp
  const sortedSessions = aliceSessions.sort((a, b) => {
    const dateA = new Date(a.createdAt || a._raw.created_at).getTime();
    const dateB = new Date(b.createdAt || b._raw.created_at).getTime();
    return dateA - dateB;
  });

  // Group duplicates: sessions within DUPLICATE_WINDOW_MS of each other
  // with same mode, words_attempted, and words_correct
  const duplicateGroups = [];
  const processed = new Set();

  for (let i = 0; i < sortedSessions.length; i++) {
    if (processed.has(sortedSessions[i].id)) continue;

    const session = sortedSessions[i];
    const sessionTime = new Date(session.createdAt || session._raw.created_at).getTime();
    const group = [session];
    processed.add(session.id);

    // Look for duplicates in the next few sessions
    for (let j = i + 1; j < sortedSessions.length; j++) {
      const candidate = sortedSessions[j];
      if (processed.has(candidate.id)) continue;

      const candidateTime = new Date(candidate.createdAt || candidate._raw.created_at).getTime();

      // If too far apart, stop looking
      if (candidateTime - sessionTime > DUPLICATE_WINDOW_MS) break;

      // Check if it's a duplicate (same mode, words attempted, words correct)
      const sameMode = session.mode === candidate.mode;
      const sameAttempted = session.wordsAttempted === candidate.wordsAttempted;
      const sameCorrect = session.wordsCorrect === candidate.wordsCorrect;

      if (sameMode && sameAttempted && sameCorrect) {
        group.push(candidate);
        processed.add(candidate.id);
      }
    }

    if (group.length > 1) {
      duplicateGroups.push(group);
    }
  }

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate sessions found!');
    return;
  }

  // Report findings
  console.log(`\n🔎 Found ${duplicateGroups.length} duplicate groups:`);

  let totalDuplicates = 0;
  duplicateGroups.forEach((group, idx) => {
    const keep = group[0];
    const remove = group.slice(1);
    totalDuplicates += remove.length;

    console.log(`\n  Group ${idx + 1}:`);
    console.log(`    Mode: ${keep.mode}`);
    console.log(`    Words: ${keep.wordsCorrect}/${keep.wordsAttempted}`);
    console.log(`    Keep: ${keep.id} (${new Date(keep.createdAt || keep._raw.created_at).toLocaleString()})`);
    console.log(`    Remove: ${remove.map(s => s.id).join(', ')}`);
  });

  console.log(`\n📊 Summary: Will remove ${totalDuplicates} duplicate sessions, keeping ${sortedSessions.length - totalDuplicates}`);

  // Collect all sessions to delete
  const sessionsToDelete = duplicateGroups.flatMap(group => group.slice(1));

  // Prompt for confirmation
  const confirmed = confirm(`Remove ${totalDuplicates} duplicate sessions? This cannot be undone.`);

  if (!confirmed) {
    console.log('❌ Cancelled by user.');
    return;
  }

  console.log('\n🗑️ Deleting duplicate sessions...');

  // Perform deletion in a batch
  await db.write(async () => {
    for (const session of sessionsToDelete) {
      await session.markAsDeleted();
    }
  });

  console.log(`✅ Deleted ${sessionsToDelete.length} duplicate sessions.`);

  // Now recalculate statistics
  console.log('\n📈 Recalculating statistics...');

  // Fetch remaining sessions
  const remainingSessions = await sessionsCollection
    .query()
    .fetch();

  const aliceRemaining = remainingSessions.filter(s => s.childId === ALICE_CHILD_ID);

  // Calculate stats by mode
  const statsByMode = {};

  for (const session of aliceRemaining) {
    const mode = session.mode;
    if (!statsByMode[mode]) {
      statsByMode[mode] = {
        totalGames: 0,
        totalWins: 0,
        wordsAttempted: 0,
        wordsCorrect: 0,
        totalTime: 0,
      };
    }

    statsByMode[mode].totalGames++;
    if (session.won) statsByMode[mode].totalWins++;
    statsByMode[mode].wordsAttempted += session.wordsAttempted || 0;
    statsByMode[mode].wordsCorrect += session.wordsCorrect || 0;
    statsByMode[mode].totalTime += session.totalTime || 0;
  }

  console.log('\n📊 New statistics by mode:');
  for (const [mode, stats] of Object.entries(statsByMode)) {
    console.log(`  ${mode}:`);
    console.log(`    Games: ${stats.totalGames}`);
    console.log(`    Wins: ${stats.totalWins}`);
    console.log(`    Words: ${stats.wordsCorrect}/${stats.wordsAttempted}`);
  }

  // Update the statistics collection
  const statsCollection = db.get('statistics');
  const allStats = await statsCollection.query().fetch();
  const aliceStats = allStats.filter(s => s.childId === ALICE_CHILD_ID);

  await db.write(async () => {
    for (const stat of aliceStats) {
      const mode = stat.mode;
      const newStats = statsByMode[mode];

      if (newStats) {
        await stat.update(record => {
          record._raw.total_games_played = newStats.totalGames;
          record._raw.total_wins = newStats.totalWins;
          record._raw.words_attempted = newStats.wordsAttempted;
          record._raw.words_correct = newStats.wordsCorrect;
          record._raw.total_time = newStats.totalTime;
        });
        console.log(`✅ Updated ${mode} statistics`);
      }
    }
  });

  console.log('\n✨ Deduplication complete!');
  console.log('💡 Refresh the page to see updated statistics.');
})();
