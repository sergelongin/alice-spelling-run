import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * PinSetupScreen - Dedicated onboarding screen for setting up Parent PIN
 *
 * Flow: Signup → Email Confirm → Login → ChildSetup → PinSetup → ProfileSelection → Home
 *
 * Features:
 * - 4-digit PIN input with auto-advance
 * - Confirmation step to verify PIN
 * - Clear messaging about PIN purpose
 */
export function PinSetupScreen() {
  const navigate = useNavigate();
  const { setParentPin, hasPinSet, needsChildSetup, children } = useAuth();

  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no children (should go to child setup first)
  useEffect(() => {
    if (needsChildSetup) {
      navigate('/setup-child', { replace: true });
    }
  }, [needsChildSetup, navigate]);

  // Redirect if already has PIN
  useEffect(() => {
    if (hasPinSet && children.length > 0) {
      navigate('/profiles', { replace: true });
    }
  }, [hasPinSet, children.length, navigate]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

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
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      refs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleSubmit(e as unknown as FormEvent);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const pin = digits.join('');

    if (pin.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    if (step === 'enter') {
      // Move to confirm step
      setStep('confirm');
      setTimeout(() => {
        confirmInputRefs.current[0]?.focus();
      }, 100);
      return;
    }

    // Confirm step - verify match
    const confirmPin = confirmDigits.join('');

    if (confirmPin !== pin) {
      setError("PINs don't match. Please try again.");
      setConfirmDigits(['', '', '', '']);
      setTimeout(() => {
        confirmInputRefs.current[0]?.focus();
      }, 100);
      return;
    }

    // Submit to server
    setIsSubmitting(true);

    const result = await setParentPin(pin);

    setIsSubmitting(false);

    if (result.success) {
      navigate('/profiles', { replace: true });
    } else {
      setError(result.error || 'Failed to set PIN. Please try again.');
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('enter');
      setConfirmDigits(['', '', '', '']);
      setError(null);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  };

  const currentDigits = step === 'confirm' ? confirmDigits : digits;
  const isComplete = currentDigits.every(d => d !== '');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
            <Lock className="text-purple-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {step === 'enter' ? 'Create Parent PIN' : 'Confirm Your PIN'}
          </h1>
          <p className="text-gray-600">
            {step === 'enter'
              ? 'This PIN protects the Parent Dashboard from little fingers'
              : 'Enter your PIN again to confirm'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* PIN Input */}
            <div className="flex justify-center gap-3">
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
                  disabled={isSubmitting}
                  className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                           focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none
                           transition-all disabled:opacity-50"
                  autoComplete="off"
                />
              ))}
            </div>

            {/* Show/Hide Toggle */}
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPin ? 'Hide PIN' : 'Show PIN'}
            </button>

            {/* Step indicator */}
            <div className="flex justify-center gap-2">
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'enter' ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'confirm' ? 'bg-purple-500' : 'bg-gray-300'}`} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isComplete || isSubmitting}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Creating PIN...
                </>
              ) : step === 'enter' ? (
                'Continue'
              ) : (
                <>
                  <CheckCircle size={18} />
                  Create PIN
                </>
              )}
            </button>

            {/* Back button in confirm step */}
            {step === 'confirm' && (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm font-medium disabled:opacity-50"
              >
                Go Back
              </button>
            )}
          </form>

          {/* Help text */}
          <p className="text-xs text-gray-400 text-center mt-6">
            You'll use this PIN to access the Parent Dashboard where you can view your child's progress, manage words, and adjust settings.
          </p>
        </div>
      </div>
    </div>
  );
}
