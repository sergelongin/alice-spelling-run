import { ChildWordBank } from '../wordbank';

/**
 * Word Bank Screen - Child-focused view of words and progress.
 *
 * Shows a game-like, visual, celebratory interface focused on what to practice next.
 * Parents access analytics through the dedicated Parent Dashboard (/parent-dashboard).
 */
export function WordBankScreen() {
  return <ChildWordBank />;
}
