import ConfettiExplosion from 'react-confetti-explosion';

interface ConfettiEffectProps {
  show: boolean;
}

export function ConfettiEffect({ show }: ConfettiEffectProps) {
  if (!show) return null;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
      <ConfettiExplosion
        force={0.8}
        duration={3000}
        particleCount={100}
        width={1600}
        colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']}
      />
    </div>
  );
}
