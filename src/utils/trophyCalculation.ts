import { TrophyTier } from '@/types';

export const calculateTrophy = (livesRemaining: number): TrophyTier => {
  switch (livesRemaining) {
    case 5:
      return 'platinum';
    case 4:
      return 'gold';
    case 3:
      return 'silver';
    case 2:
      return 'bronze';
    default:
      return 'participant';
  }
};

export const getTrophyDisplayName = (tier: TrophyTier): string => {
  const names: Record<TrophyTier, string> = {
    platinum: 'Platinum Trophy',
    gold: 'Gold Trophy',
    silver: 'Silver Trophy',
    bronze: 'Bronze Trophy',
    participant: 'Participant Trophy',
  };
  return names[tier];
};

export const getTrophyEmoji = (tier: TrophyTier): string => {
  const emojis: Record<TrophyTier, string> = {
    platinum: '🏆',
    gold: '🥇',
    silver: '🥈',
    bronze: '🥉',
    participant: '🎖️',
  };
  return emojis[tier];
};

export const getTrophyColor = (tier: TrophyTier): string => {
  const colors: Record<TrophyTier, string> = {
    platinum: '#E5E4E2',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    participant: '#4A90A4',
  };
  return colors[tier];
};
