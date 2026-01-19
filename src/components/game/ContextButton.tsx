import { useState, useCallback } from 'react';
import { BookOpen, Check } from 'lucide-react';
import { Button } from '../common';
import { ContextLevel } from '@/hooks';

interface ContextButtonProps {
  contextLevel: ContextLevel;
  onRequestContext: () => Promise<void>;
  disabled?: boolean;
}

const LEVEL_LABELS: Record<ContextLevel, string> = {
  word: 'More Context',
  definition: 'Full Context',
  full: 'Full Context',
};

const LEVEL_DESCRIPTIONS: Record<ContextLevel, string> = {
  word: 'Hear the definition',
  definition: 'Hear an example sentence',
  full: 'All context provided',
};

export function ContextButton({
  contextLevel,
  onRequestContext,
  disabled = false,
}: ContextButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const canEscalate = contextLevel !== 'full';

  const handleClick = useCallback(async () => {
    if (cooldown || isSpeaking || disabled || !canEscalate) return;

    setIsSpeaking(true);
    setCooldown(true);

    try {
      await onRequestContext();
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      setIsSpeaking(false);

      // Cooldown to prevent spam clicking
      setTimeout(() => setCooldown(false), 1000);
    }
  }, [cooldown, isSpeaking, disabled, canEscalate, onRequestContext]);

  const isDisabled = disabled || isSpeaking || cooldown || !canEscalate;

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant="secondary"
      size="md"
      className="flex items-center gap-2"
      preventFocusSteal
      title={LEVEL_DESCRIPTIONS[contextLevel]}
    >
      {canEscalate ? (
        <BookOpen
          size={24}
          className={isSpeaking ? 'animate-pulse text-blue-500' : ''}
        />
      ) : (
        <Check size={24} className="text-green-500" />
      )}
      <span>{LEVEL_LABELS[contextLevel]}</span>
    </Button>
  );
}
