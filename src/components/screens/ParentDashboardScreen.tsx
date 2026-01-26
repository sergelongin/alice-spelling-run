import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useParentDashboardAccess } from '@/hooks';
import { PinModal } from '@/components/wordbank';
import { Button } from '@/components/common';
import { EditProfileModal, DeleteConfirmDialog } from '@/components/profiles';
import { ChildSummaryCard } from '@/components/parent/ChildSummaryCard';
import { FamilyOverview } from '@/components/parent/FamilyOverview';
import { AttentionNeededList } from '@/components/parent/AttentionNeededList';
import type { ChildProfile } from '@/types/auth';

/**
 * Parent Dashboard Screen - Unified view of all children's progress
 *
 * Features:
 * - PIN protected access
 * - Multi-child overview with summary cards
 * - Family aggregate statistics
 * - Attention needed alerts
 * - Click-through to individual child detail views
 */
export function ParentDashboardScreen() {
  const navigate = useNavigate();
  const { children, isParentOrSuperAdmin, hasChildren } = useAuth();
  const {
    isAuthorized,
    isPinModalOpen,
    pinError,
    isCreatingPin,
    requestAccess,
    verifyPin,
    createPin,
    closePinModal,
  } = useParentDashboardAccess();

  // Modal state for edit/delete
  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [deletingChild, setDeletingChild] = useState<ChildProfile | null>(null);

  // Request PIN on mount if not authorized
  useEffect(() => {
    if (!isAuthorized) {
      requestAccess();
    }
  }, [isAuthorized, requestAccess]);

  // Handle PIN submission
  const handlePinSubmit = (pin: string) => {
    if (isCreatingPin) {
      createPin(pin);
    } else {
      verifyPin(pin);
    }
  };

  // Handle PIN modal close - navigate back if not authorized
  const handlePinClose = () => {
    closePinModal();
    if (!isAuthorized) {
      navigate('/');
    }
  };

  // Show PIN modal if not authorized
  if (!isAuthorized) {
    return (
      <PinModal
        isOpen={isPinModalOpen}
        onClose={handlePinClose}
        onSubmit={handlePinSubmit}
        isCreating={isCreatingPin}
        error={pinError}
      />
    );
  }

  // Redirect non-parents
  if (!isParentOrSuperAdmin || !hasChildren) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <p className="text-gray-600 mb-4">Parent Dashboard is only available for parent accounts with children.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Home
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Parent Dashboard
          </h1>
        </div>
      </div>

      {/* Main content */}
      <div className="space-y-6">
        {/* Children section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Children</h2>
        </div>

        {/* Children grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map(child => (
            <ChildSummaryCard
              key={child.id}
              child={child}
              onClick={() => navigate(`/parent-dashboard/child/${child.id}`)}
              onEdit={() => setEditingChild(child)}
              onDelete={() => setDeletingChild(child)}
            />
          ))}

          {/* Add child card */}
          <button
            onClick={() => navigate('/setup-child')}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/50 transition-colors min-h-[180px]"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus size={24} className="text-gray-400" />
            </div>
            <span className="text-sm font-medium text-gray-500">Add Child</span>
          </button>
        </div>

        {/* Family Overview */}
        <FamilyOverview children={children} />

        {/* Needs Attention */}
        <AttentionNeededList children={children} />
      </div>

      {/* Edit Profile Modal */}
      {editingChild && (
        <EditProfileModal
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSaved={() => setEditingChild(null)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {deletingChild && (
        <DeleteConfirmDialog
          child={deletingChild}
          onClose={() => setDeletingChild(null)}
          onDeleted={() => setDeletingChild(null)}
        />
      )}
    </div>
  );
}
