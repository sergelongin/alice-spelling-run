import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        setError(error.message);
        setIsGoogleLoading(false);
      }
      // If successful, page will redirect to Google
    } catch {
      setError('Failed to sign in with Google. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    const result = await signIn({ email: email.trim(), password });

    if (result.error) {
      // Check if the error is about email not being confirmed
      if (result.error.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true);
        setSubmittedEmail(email.trim());
        return;
      }
      setError(result.error);
    } else {
      onSuccess?.();
    }
  };

  const handleResendConfirmation = async () => {
    setResendStatus('sending');
    try {
      await supabase.auth.resend({
        type: 'signup',
        email: submittedEmail,
      });
      setResendStatus('sent');
    } catch {
      setResendStatus('idle');
      setError('Failed to resend confirmation email. Please try again.');
    }
  };

  const handleBackToSignIn = () => {
    setNeedsConfirmation(false);
    setResendStatus('idle');
    setError(null);
  };

  // Show email confirmation needed UI
  if (needsConfirmation) {
    return (
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
          <Mail className="text-amber-600" size={32} />
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-800">Email Not Confirmed</h3>
          <p className="text-gray-600">
            Please check your inbox for a confirmation link. You need to verify your email before signing in.
          </p>
          <p className="text-sm text-gray-500">
            Email sent to: <span className="font-medium">{submittedEmail}</span>
          </p>
        </div>

        <div className="space-y-3">
          {resendStatus === 'sent' ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle size={18} />
              <span>Confirmation email sent!</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResendConfirmation}
              disabled={resendStatus === 'sending'}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {resendStatus === 'sending' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                'Resend confirmation email'
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleBackToSignIn}
            className="w-full py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || isGoogleLoading}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      {/* Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading || isGoogleLoading}
        className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-3"
      >
        {isGoogleLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
            Redirecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </>
        )}
      </button>

      <p className="text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign up
        </Link>
      </p>
    </form>
  );
}
