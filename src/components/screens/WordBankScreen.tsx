import { useWordBankMode } from '@/hooks';
import { ChildWordBank, ParentWordBank, PinModal } from '../wordbank';

/**
 * Word Bank Screen with dual-mode UX: Child Mode and Parent Mode.
 *
 * Child Mode: Game-like, visual, celebratory - focused on what to practice next.
 * Parent Mode: Data-rich analytics, word management, insights - PIN protected.
 *
 * Default: Child Mode on first visit.
 * PIN Protection: Required to access Parent Mode.
 */
export function WordBankScreen() {
  const {
    mode,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    switchToChildMode,
    requestParentMode,
    verifyPin,
    createPin,
    closePinModal,
  } = useWordBankMode();

  const handlePinSubmit = (pin: string) => {
    if (isCreatingPin) {
      createPin(pin);
    } else {
      verifyPin(pin);
    }
  };

  return (
    <>
      {mode === 'child' ? (
        <ChildWordBank onRequestParentMode={requestParentMode} />
      ) : (
        <ParentWordBank onSwitchToChildMode={switchToChildMode} />
      )}

      {/* PIN Modal for Parent Mode access */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={closePinModal}
        onSubmit={handlePinSubmit}
        isCreating={isCreatingPin}
        error={pinError}
      />
    </>
  );
}
