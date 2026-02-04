import { useState, useRef, useEffect, type FormEvent } from 'react';
import { X, Lock, Eye, EyeOff, AlertCircle, CheckCircle, Mail, Key } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '../common';

interface PinResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'auth' | 'new-pin' | 'confirm-pin' | 'success';

/**
 * Modal for resetting Parent PIN via re-authentication
 *
 * Flow:
 * 1. Re-authenticate with password (or OAuth)
 * 2. Enter new 4-digit PIN
 * 3. Confirm new PIN
 * 4. Success message
 */
export function PinResetModal({ isOpen, onClose, onSuccess }: PinResetModalProps) {
  const { profile, setParentPin } = useAuth();

  const [step, setStep] = useState<Step>('auth');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('auth');
      setPassword('');
      setDigits(['', '', '', '']);
      setConfirmDigits(['', '', '', '']);
      setError(null);
      setIsLoading(false);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key
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

  // Handle re-authentication
  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      // Re-authenticate by signing in again
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password,
      });

      if (authError) {
        setError('Incorrect password. Please try again.');
        setIsLoading(false);
        return;
      }

      // Move to new PIN step
      setStep('new-pin');
      setPassword(''); // Clear password from memory
      setTimeout(() => {
        pinInputRefs.current[0]?.focus();
      }, 100);
    } catch {
      setError('Authentication failed. Please try again.');
    }

    setIsLoading(false);
  };

  // Handle PIN digit change
  const handleDigitChange = (index: number, value: string, isConfirm: boolean = false) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    if (value && !/^\d$/.test(value)) {
      return;
    }

    const currentDigits = isConfirm ? [...confirmDigits] : [...digits];
    const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;

    currentDigits[index] = value;

    if (isConfirm) {
      setConfirmDigits(currentDigits);
    } else {
      setDigits(currentDigits);
    }

    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm: boolean = false) => {
    const currentDigits = isConfirm ? confirmDigits : digits;
    const refs = isConfirm ? confirmPinInputRefs : pinInputRefs;

    if (e.key === 'Backspace') {
      if (!currentDigits[index] && index > 0) {
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      refs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      if (step === 'new-pin') {
        handleNewPinSubmit();
      } else if (step === 'confirm-pin') {
        handleConfirmSubmit();
      }
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

  // Handle new PIN submission
  const handleNewPinSubmit = () => {
    const pin = digits.join('');

    if (pin.length !== 4) {
      return;
    }

    setStep('confirm-pin');
    setError(null);
    setTimeout(() => {
      confirmPinInputRefs.current[0]?.focus();
    }, 100);
  };

  // Handle PIN confirmation
  const handleConfirmSubmit = async () => {
    const pin = digits.join('');
    const confirmPin = confirmDigits.join('');

    if (confirmPin.length !== 4) {
      return;
    }

    if (confirmPin !== pin) {
      setError("PINs don't match. Please try again.");
      setConfirmDigits(['', '', '', '']);
      setTimeout(() => {
        confirmPinInputRefs.current[0]?.focus();
      }, 100);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await setParentPin(pin);

    if (result.success) {
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } else {
      setError(result.error || 'Failed to set PIN. Please try again.');
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  const isNewPinComplete = digits.every(d => d !== '');
  const isConfirmPinComplete = confirmDigits.every(d => d !== '');

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
                  Reset Parent PIN
                </h2>
                <p className="text-purple-100 text-sm">
                  {step === 'auth'
                    ? 'Verify your identity first'
                    : step === 'new-pin'
                    ? 'Enter your new PIN'
                    : step === 'confirm-pin'
                    ? 'Confirm your new PIN'
                    : 'PIN reset successful!'}
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
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Step: Authentication */}
          {step === 'auth' && (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Password
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter your password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail size={14} />
                <span>{profile?.email}</span>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={!password || isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Verifying...
                  </span>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>
          )}

          {/* Step: New PIN */}
          {step === 'new-pin' && (
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map(index => (
                  <input
                    key={`new-${index}`}
                    ref={el => { pinInputRefs.current[index] = el; }}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={1}
                    value={digits[index]}
                    onChange={e => handleDigitChange(index, e.target.value, false)}
                    onKeyDown={e => handleKeyDown(index, e, false)}
                    onPaste={e => handlePaste(e, false)}
                    disabled={isLoading}
                    className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                             focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none
                             transition-all disabled:opacity-50"
                    autoComplete="off"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPin ? 'Hide PIN' : 'Show PIN'}
              </button>

              <Button
                onClick={handleNewPinSubmit}
                variant="primary"
                disabled={!isNewPinComplete}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
              >
                Continue
              </Button>
            </div>
          )}

          {/* Step: Confirm PIN */}
          {step === 'confirm-pin' && (
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map(index => (
                  <input
                    key={`confirm-${index}`}
                    ref={el => { confirmPinInputRefs.current[index] = el; }}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={1}
                    value={confirmDigits[index]}
                    onChange={e => handleDigitChange(index, e.target.value, true)}
                    onKeyDown={e => handleKeyDown(index, e, true)}
                    onPaste={e => handlePaste(e, true)}
                    disabled={isLoading}
                    className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                             focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none
                             transition-all disabled:opacity-50"
                    autoComplete="off"
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto"
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPin ? 'Hide PIN' : 'Show PIN'}
              </button>

              <Button
                onClick={handleConfirmSubmit}
                variant="primary"
                disabled={!isConfirmPinComplete || isLoading}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Setting PIN...
                  </span>
                ) : (
                  'Reset PIN'
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('new-pin');
                  setConfirmDigits(['', '', '', '']);
                  setError(null);
                  setTimeout(() => {
                    pinInputRefs.current[0]?.focus();
                  }, 100);
                }}
                disabled={isLoading}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Go Back
              </button>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                PIN Reset Complete!
              </h3>
              <p className="text-sm text-gray-600">
                Your new Parent PIN is now active.
              </p>
            </div>
          )}

          {/* Step indicator */}
          {step !== 'success' && (
            <div className="flex justify-center gap-2 mt-4">
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'auth' ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'new-pin' ? 'bg-purple-500' : 'bg-gray-300'}`} />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'confirm-pin' ? 'bg-purple-500' : 'bg-gray-300'}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
