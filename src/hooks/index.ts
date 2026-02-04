export { useLocalStorage } from './useLocalStorage';
export { useTextToSpeech } from './useTextToSpeech';
export { useGameTimer } from './useGameTimer';
export { useGameState } from './useGameState';
export { useWildlands, calculateScore } from './useWildlands';
export { useSpellingHint } from './useSpellingHint';
export { useCalibration } from './useCalibration';
export { useWordContext } from './useWordContext';
export { useWordBankMode } from './useWordBankMode';
export { useParentDashboardAccess, revokeParentDashboardAccess } from './useParentDashboardAccess';
export { useOnlineStatus } from './useOnlineStatus';
export { useFreshGameData } from './useFreshGameData';
export { useVisualViewport } from './useVisualViewport';
export {
  useChildData,
  calculateAccuracy,
  getLastActivityDate,
  getDaysSinceActivity,
  countMasteredWords,
  countActiveWords,
  calculateStreak,
  getStrugglingWordsList,
} from './useChildData';
export type { ContextLevel } from './useWordContext';
export type { WordBankMode } from './useWordBankMode';
export type { UseChildDataResult } from './useChildData';
