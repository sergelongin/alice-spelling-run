import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useParentDashboardAccess } from '@/hooks';
import { GameProvider } from '@/context/GameContextDB';
import { ParentWordBank, PinModal } from '@/components/wordbank';
import { Button } from '@/components/common';
import { ChildHeaderCard, PinResetModal } from '@/components/parent';
import { EditProfileModal, DeleteConfirmDialog, ResetProgressDialog } from '@/components/profiles';

/**
 * Child Word Bank Screen - Renders ParentWordBank for a specific child
 *
 * This screen wraps the ParentWordBank component with a GameProvider
 * configured for the selected child, enabling word bank management.
 */
export function ChildWordBankScreen() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { children, isParentOrSuperAdmin, hasChildren, setParentPin } = useAuth();
  const {
    isAuthorized,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    isVerifying,
    requestAccess,
    verifyPin,
    closePinModal,
  } = useParentDashboardAccess();

  // Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);

  // Find the current child
  const currentChild = children.find(c => c.id === childId);

  // Request PIN on mount if not authorized
  useEffect(() => {
    if (!isAuthorized) {
      requestAccess();
    }
  }, [isAuthorized, requestAccess]);

  // Handle PIN submission
  const handlePinSubmit = async (pin: string) => {
    if (isCreatingPin) {
      await setParentPin(pin);
    } else {
      await verifyPin(pin);
    }
  };

  // Handle PIN modal close - navigate back if not authorized
  const handlePinClose = () => {
    closePinModal();
    if (!isAuthorized) {
      navigate('/parent-dashboard');
    }
  };

  // Handle forgot PIN
  const handleForgotPin = () => {
    closePinModal();
    setShowPinReset(true);
  };

  // Handle PIN reset success
  const handlePinResetSuccess = () => {
    setShowPinReset(false);
    requestAccess();
  };

  // Show PIN modal if not authorized
  if (!isAuthorized) {
    return (
      <>
        <PinModal
          isOpen={isPinModalOpen}
          onClose={handlePinClose}
          onSubmit={handlePinSubmit}
          isCreating={isCreatingPin}
          error={pinError}
          isLoading={isVerifying}
          onForgotPin={handleForgotPin}
        />
        <PinResetModal
          isOpen={showPinReset}
          onClose={() => setShowPinReset(false)}
          onSuccess={handlePinResetSuccess}
        />
      </>
    );
  }

  // Redirect if not parent or no children
  if (!isParentOrSuperAdmin || !hasChildren) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">Parent Dashboard is only available for parent accounts with children.</p>
        <Button onClick={() => navigate('/home')}>Go Home</Button>
      </div>
    );
  }

  // Handle child not found
  if (!currentChild || !childId) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">Child not found.</p>
        <Button onClick={() => navigate('/parent-dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  // Handle export
  const handleExport = () => {
    // Export is handled inside ParentWordBank, but we need a handler for the header
    // Trigger a custom event that ParentWordBank listens to, or just show the export modal
    // For simplicity, we'll just navigate to the word bank which has the export functionality
    // The actual export happens in ParentWordBank
  };

  // Render ParentWordBank with GameProvider for this specific child
  return (
    <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Child navigation card */}
      <ChildHeaderCard
        child={currentChild}
        allChildren={children}
        onEdit={() => setShowEditModal(true)}
        onResetProgress={() => setShowResetDialog(true)}
        onExport={handleExport}
        onDelete={() => setShowDeleteDialog(true)}
      />

      {/* Word Bank Content */}
      <GameProvider key={childId} childId={childId}>
        <ParentWordBank hideHeader childName={currentChild.name} />
      </GameProvider>

      {/* Edit Profile Modal */}
      {showEditModal && currentChild && (
        <EditProfileModal
          child={currentChild}
          onClose={() => setShowEditModal(false)}
          onSaved={() => setShowEditModal(false)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteDialog && currentChild && (
        <DeleteConfirmDialog
          child={currentChild}
          onClose={() => setShowDeleteDialog(false)}
          onDeleted={() => {
            setShowDeleteDialog(false);
            navigate('/parent-dashboard');
          }}
        />
      )}

      {/* Reset Progress Dialog */}
      {showResetDialog && currentChild && (
        <ResetProgressDialog
          child={currentChild}
          onClose={() => setShowResetDialog(false)}
          onReset={() => {
            setShowResetDialog(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
