import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LandingHeader,
  HeroSection,
  HowItWorks,
  Benefits,
  AgeSection,
  Footer,
} from '@/components/landing';

export function LandingPage() {
  const { user, needsChildSetup, needsProfileSelection, hasChildren, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to appropriate screen
  useEffect(() => {
    if (!isLoading && user) {
      if (needsChildSetup) {
        navigate('/setup-child', { replace: true });
      } else if (hasChildren && needsProfileSelection) {
        navigate('/profiles', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [user, needsChildSetup, needsProfileSelection, hasChildren, isLoading, navigate]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  // If user is authenticated, don't render landing page (redirect will happen)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />

      <main className="flex-1">
        <HeroSection />
        <HowItWorks />
        <Benefits />
        <AgeSection />
      </main>

      <Footer />
    </div>
  );
}
