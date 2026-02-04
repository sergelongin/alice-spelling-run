import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginForm } from '@/components/auth';
import { useAuth } from '@/context/AuthContext';

export function LoginScreen() {
  const { user, needsChildSetup, needsProfileSelection, hasChildren, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect destination from state, or default to home
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/home';

  useEffect(() => {
    if (!isLoading && user) {
      // User is already logged in - redirect appropriately
      if (needsChildSetup) {
        navigate('/setup-child', { replace: true });
      } else if (hasChildren && needsProfileSelection) {
        // Netflix-style: redirect to profile selection
        navigate('/profiles', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, needsChildSetup, needsProfileSelection, hasChildren, isLoading, navigate, from]);

  const handleSuccess = () => {
    // Navigation will be handled by the effect above when auth state updates
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to continue to Alice Spelling Run</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <LoginForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
