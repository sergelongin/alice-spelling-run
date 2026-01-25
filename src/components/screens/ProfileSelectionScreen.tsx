import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useParentDashboardAccess } from '@/hooks';
import { ProfileCard, ParentsCard } from '@/components/profiles';
import { PinModal } from '@/components/wordbank';

export function ProfileSelectionScreen() {
  const { children, activeChild, selectProfile } = useAuth();
  const navigate = useNavigate();
  const {
    isAuthorized,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    requestAccess,
    verifyPin,
    createPin,
    closePinModal,
    revokeAccess,
  } = useParentDashboardAccess();

  // Revoke parent dashboard access when returning to profile selection
  // This ensures users must re-enter PIN when navigating from parent mode back to profiles
  useEffect(() => {
    revokeAccess();
  }, [revokeAccess]);

  // Navigate to parent dashboard after successful PIN verification
  useEffect(() => {
    if (isAuthorized && isPinModalOpen === false) {
      // Only navigate if we just completed PIN verification (modal was open)
      // Check if we came from clicking the Parents card
      const pendingNavigation = sessionStorage.getItem('pending-parent-dashboard-nav');
      if (pendingNavigation === 'true') {
        sessionStorage.removeItem('pending-parent-dashboard-nav');
        navigate('/parent-dashboard');
      }
    }
  }, [isAuthorized, isPinModalOpen, navigate]);

  const handleSelectProfile = (childId: string) => {
    selectProfile(childId);
    navigate('/', { replace: true });
  };

  const handleParentDashboard = () => {
    if (isAuthorized) {
      navigate('/parent-dashboard');
    } else {
      // Mark that we want to navigate after PIN verification
      sessionStorage.setItem('pending-parent-dashboard-nav', 'true');
      requestAccess();
    }
  };

  const handlePinSubmit = (pin: string) => {
    if (isCreatingPin) {
      createPin(pin);
    } else {
      verifyPin(pin);
    }
  };

  const handlePinClose = () => {
    sessionStorage.removeItem('pending-parent-dashboard-nav');
    closePinModal();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-12">
            Who's playing?
          </h1>

          {/* Profile grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {children.map((child) => (
              <ProfileCard
                key={child.id}
                child={child}
                onClick={() => handleSelectProfile(child.id)}
                isSelected={activeChild?.id === child.id}
              />
            ))}
            <ParentsCard onClick={handleParentDashboard} />
          </div>
        </div>
      </div>

      {/* PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={handlePinClose}
        onSubmit={handlePinSubmit}
        isCreating={isCreatingPin}
        error={pinError}
      />
    </div>
  );
}
