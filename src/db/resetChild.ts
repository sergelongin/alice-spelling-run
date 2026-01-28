/**
 * WatermelonDB Reset Helper
 * Clears all local data for a specific child
 */

import { Q } from '@nozbe/watermelondb';
import {
  database,
  wordProgressCollection,
  gameSessionCollection,
  statisticsCollection,
  calibrationCollection,
  learningProgressCollection,
  wordBankMetadataCollection,
} from './index';

/**
 * Permanently deletes all WatermelonDB records for a specific child.
 * This is used when resetting a child's progress.
 *
 * @param childId - The child's UUID
 * @returns Object with counts of deleted records per table
 */
export async function resetWatermelonDBForChild(childId: string): Promise<{
  word_progress: number;
  game_sessions: number;
  statistics: number;
  calibration: number;
  learning_progress: number;
  word_bank_metadata: number;
}> {
  console.log('[resetWatermelonDB] Starting reset for child:', childId);

  const counts = {
    word_progress: 0,
    game_sessions: 0,
    statistics: 0,
    calibration: 0,
    learning_progress: 0,
    word_bank_metadata: 0,
  };

  await database.write(async () => {
    // Delete word progress
    const wordProgressRecords = await wordProgressCollection
      .query(Q.where('child_id', childId))
      .fetch();
    counts.word_progress = wordProgressRecords.length;
    console.log('[resetWatermelonDB] Found', wordProgressRecords.length, 'word_progress records to delete');
    for (const record of wordProgressRecords) {
      await record.destroyPermanently();
    }

    // Delete game sessions
    const gameSessionRecords = await gameSessionCollection
      .query(Q.where('child_id', childId))
      .fetch();
    counts.game_sessions = gameSessionRecords.length;
    console.log('[resetWatermelonDB] Found', gameSessionRecords.length, 'game_sessions records to delete');
    for (const record of gameSessionRecords) {
      await record.destroyPermanently();
    }

    // Delete statistics
    const statisticsRecords = await statisticsCollection
      .query(Q.where('child_id', childId))
      .fetch();
    counts.statistics = statisticsRecords.length;
    console.log('[resetWatermelonDB] Found', statisticsRecords.length, 'statistics records to delete');
    for (const record of statisticsRecords) {
      await record.destroyPermanently();
    }

    // Delete calibration
    const calibrationRecords = await calibrationCollection
      .query(Q.where('child_id', childId))
      .fetch();
    counts.calibration = calibrationRecords.length;
    console.log('[resetWatermelonDB] Found', calibrationRecords.length, 'calibration records to delete');
    for (const record of calibrationRecords) {
      await record.destroyPermanently();
    }

    // Delete learning progress
    const learningProgressRecords = await learningProgressCollection
      .query(Q.where('child_id', childId))
      .fetch();
    counts.learning_progress = learningProgressRecords.length;
    console.log('[resetWatermelonDB] Found', learningProgressRecords.length, 'learning_progress records to delete');
    for (const record of learningProgressRecords) {
      await record.destroyPermanently();
    }

    // Delete word bank metadata
    const wordBankMetadataRecords = await wordBankMetadataCollection
      .query(Q.where('child_id', childId))
      .fetch();
    counts.word_bank_metadata = wordBankMetadataRecords.length;
    console.log('[resetWatermelonDB] Found', wordBankMetadataRecords.length, 'word_bank_metadata records to delete');
    for (const record of wordBankMetadataRecords) {
      await record.destroyPermanently();
    }
  });

  // Verify deletion was successful
  const verifyWp = await wordProgressCollection.query(Q.where('child_id', childId)).fetchCount();
  const verifyGs = await gameSessionCollection.query(Q.where('child_id', childId)).fetchCount();
  const verifySt = await statisticsCollection.query(Q.where('child_id', childId)).fetchCount();

  if (verifyWp > 0 || verifyGs > 0 || verifySt > 0) {
    console.error('[resetWatermelonDB] VERIFICATION FAILED! Records still exist:', {
      word_progress: verifyWp,
      game_sessions: verifyGs,
      statistics: verifySt,
    });
  } else {
    console.log('[resetWatermelonDB] Verified: All records deleted successfully');
  }

  console.log('[resetWatermelonDB] Reset complete. Deleted counts:', counts);
  return counts;
}
