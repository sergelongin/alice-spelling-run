import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignupForm } from '@/components/auth';
import { useAuth } from '@/context/AuthContext';

export function SignupScreen() {
  const { user, needsChildSetup, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      // User signed up and is now logged in
      if (needsChildSetup) {
        navigate('/setup-child', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, needsChildSetup, isLoading, navigate]);

  const handleSuccess = () => {
    // For email confirmation flow, the form handles the success message
    // For instant login (no email confirmation), the effect above handles redirect
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Start your spelling adventure today</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <SignupForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
