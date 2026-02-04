import React, { useState, useRef, useEffect } from 'react';
import { X, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../common';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void | Promise<void>;
  isCreating: boolean;
  error: string | null;
  isLoading?: boolean;
  onForgotPin?: () => void;
}

/**
 * Modal for entering or creating a 4-digit PIN to access Parent Mode.
 *
 * Features:
 * - 4 individual digit inputs with auto-advance
 * - Backspace moves to previous input
 * - Show/hide PIN toggle
 * - Different messaging for create vs verify flows
 */
export function PinModal({ isOpen, onClose, onSubmit, isCreating, error, isLoading = false, onForgotPin }: PinModalProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setConfirmDigits(['', '', '', '']);
      setStep('enter');
      setConfirmError(null);
      // Focus first input after a short delay to allow modal to render
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus first input when error clears
  useEffect(() => {
    if (!error && isOpen) {
      inputRefs.current[0]?.focus();
    }
  }, [error, isOpen]);

  const handleDigitChange = (index: number, value: string, isConfirm: boolean = false) => {
    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1);
    }

    // Only allow numbers
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const currentDigits = isConfirm ? [...confirmDigits] : [...digits];
    const refs = isConfirm ? confirmInputRefs : inputRefs;

    currentDigits[index] = value;

    if (isConfirm) {
      setConfirmDigits(currentDigits);
    } else {
      setDigits(currentDigits);
    }

    // Auto-advance to next input
    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean = false) => {
    const currentDigits = isConfirm ? confirmDigits : digits;
    const refs = isConfirm ? confirmInputRefs : inputRefs;

    if (e.key === 'Backspace') {
      if (!currentDigits[index] && index > 0) {
        // Move to previous input if current is empty
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      refs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleSubmitAttempt();
    }
  };

  const handlePaste = (e: React.ClipboardEvent, isConfirm: boolean = false) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);

    if (pastedData.length === 4) {
      const newDigits = pastedData.split('');
      if (isConfirm) {
        setConfirmDigits(newDigits);
      } else {
        setDigits(newDigits);
      }
    }
  };

  const handleSubmitAttempt = async () => {
    const pin = digits.join('');

    if (pin.length !== 4) {
      return;
    }

    if (isCreating && step === 'enter') {
      // Move to confirm step
      setStep('confirm');
      setConfirmError(null);
      setTimeout(() => {
        confirmInputRefs.current[0]?.focus();
      }, 100);
    } else if (isCreating && step === 'confirm') {
      // Verify confirmation matches
      const confirmPin = confirmDigits.join('');
      if (confirmPin !== pin) {
        setConfirmError("PINs don't match. Please try again.");
        setConfirmDigits(['', '', '', '']);
        setTimeout(() => {
          confirmInputRefs.current[0]?.focus();
        }, 100);
      } else {
        setIsSubmitting(true);
        await onSubmit(pin);
        setIsSubmitting(false);
      }
    } else {
      // Just verifying existing PIN
      setIsSubmitting(true);
      await onSubmit(pin);
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    const pin = digits.join('');
    const confirmPin = confirmDigits.join('');

    if (confirmPin.length !== 4) {
      return;
    }

    if (confirmPin !== pin) {
      setConfirmError("PINs don't match. Please try again.");
      setConfirmDigits(['', '', '', '']);
      setTimeout(() => {
        confirmInputRefs.current[0]?.focus();
      }, 100);
    } else {
      setIsSubmitting(true);
      await onSubmit(pin);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentDigits = step === 'confirm' ? confirmDigits : digits;
  const isComplete = currentDigits.every(d => d !== '');
  const displayError = step === 'confirm' ? confirmError : error;
  const isDisabled = isLoading || isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isCreating ? 'Create Parent PIN' : 'Enter Parent PIN'}
                </h2>
                <p className="text-purple-100 text-sm">
                  {isCreating && step === 'enter'
                    ? 'Set a 4-digit PIN to access Parent Mode'
                    : isCreating && step === 'confirm'
                    ? 'Confirm your PIN'
                    : 'Enter your PIN to continue'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* PIN Input */}
          <div className="flex justify-center gap-3 mb-4">
            {[0, 1, 2, 3].map(index => (
              <input
                key={`${step}-${index}`}
                ref={el => {
                  if (step === 'confirm') {
                    confirmInputRefs.current[index] = el;
                  } else {
                    inputRefs.current[index] = el;
                  }
                }}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={1}
                value={currentDigits[index]}
                onChange={e => handleDigitChange(index, e.target.value, step === 'confirm')}
                onKeyDown={e => handleKeyDown(index, e, step === 'confirm')}
                onPaste={e => handlePaste(e, step === 'confirm')}
                className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                         focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none
                         transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="off"
                disabled={isDisabled}
              />
            ))}
          </div>

          {/* Show/Hide Toggle */}
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto mb-4"
          >
            {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPin ? 'Hide PIN' : 'Show PIN'}
          </button>

          {/* Error Message */}
          {displayError && (
            <div className="text-red-500 text-sm text-center mb-4 bg-red-50 px-3 py-2 rounded-lg">
              {displayError}
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={step === 'confirm' ? handleConfirmSubmit : handleSubmitAttempt}
            variant="primary"
            disabled={!isComplete || isDisabled}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
          >
            {isDisabled ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Verifying...
              </span>
            ) : isCreating && step === 'enter' ? (
              'Continue'
            ) : isCreating && step === 'confirm' ? (
              'Create PIN'
            ) : (
              'Unlock Parent Mode'
            )}
          </Button>

          {/* Forgot PIN link */}
          {!isCreating && onForgotPin && (
            <button
              type="button"
              onClick={onForgotPin}
              disabled={isDisabled}
              className="w-full text-sm text-purple-600 hover:text-purple-700 hover:underline mt-2 disabled:opacity-50"
            >
              Forgot PIN?
            </button>
          )}

          {/* Step indicator for creation flow */}
          {isCreating && (
            <div className="flex justify-center gap-2 mt-4">
              <div className={`w-2 h-2 rounded-full ${step === 'enter' ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-purple-500' : 'bg-gray-300'}`} />
            </div>
          )}

          {/* Help text */}
          {isCreating && (
            <p className="text-xs text-gray-400 text-center mt-4">
              This PIN keeps Parent Mode private. You can reset it in settings if you forget.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
