import { useState, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { Button } from '../common';

interface RepeatButtonProps {
  onRepeat: () => Promise<void>;
  disabled?: boolean;
}

export function RepeatButton({ onRepeat, disabled = false }: RepeatButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleClick = useCallback(async () => {
    if (cooldown || isSpeaking || disabled) return;

    setIsSpeaking(true);
    setCooldown(true);

    try {
      await onRepeat();
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      setIsSpeaking(false);

      // Cooldown to prevent spam clicking
      setTimeout(() => setCooldown(false), 1000);
    }
  }, [cooldown, isSpeaking, disabled, onRepeat]);

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isSpeaking || cooldown}
      variant="secondary"
      size="md"
      className="flex items-center gap-2"
      preventFocusSteal
    >
      <Volume2
        size={24}
        className={isSpeaking ? 'animate-pulse text-blue-500' : ''}
      />
      <span>Hear Word Again</span>
    </Button>
  );
}
