import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProfileAvatar, AddProfileCard, EditProfileModal, DeleteConfirmDialog } from '@/components/profiles';
import type { ChildProfile } from '@/types/auth';

interface ManageableProfileCardProps {
  child: ChildProfile;
  onEdit: () => void;
  onDelete: () => void;
}

const GRADE_BADGE_COLORS: Record<number, string> = {
  3: 'bg-orange-100 text-orange-700',
  4: 'bg-purple-100 text-purple-700',
  5: 'bg-amber-100 text-amber-700',
  6: 'bg-blue-100 text-blue-700',
};

function ManageableProfileCard({ child, onEdit, onDelete }: ManageableProfileCardProps) {
  const badgeColor = GRADE_BADGE_COLORS[child.grade_level] || GRADE_BADGE_COLORS[4];

  return (
    <div className="relative group flex flex-col items-center gap-3 p-6 bg-gray-800/50 border-2 border-gray-700 rounded-xl">
      {/* Action buttons */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="Edit profile"
        >
          <Pencil size={16} className="text-gray-300" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors"
          title="Delete profile"
        >
          <Trash2 size={16} className="text-gray-300" />
        </button>
      </div>

      <ProfileAvatar
        name={child.name}
        gradeLevel={child.grade_level}
        size="xl"
      />

      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">
          {child.name}
        </h3>
        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
          Grade {child.grade_level}
        </span>
      </div>
    </div>
  );
}

export function ManageProfilesScreen() {
  const { children, hasChildren } = useAuth();
  const navigate = useNavigate();

  const [editingChild, setEditingChild] = useState<ChildProfile | null>(null);
  const [deletingChild, setDeletingChild] = useState<ChildProfile | null>(null);

  // If last child is deleted, redirect to setup
  useEffect(() => {
    if (!hasChildren) {
      navigate('/setup-child', { replace: true });
    }
  }, [hasChildren, navigate]);

  const handleAddProfile = () => {
    navigate('/setup-child');
  };

  const handleDeleted = () => {
    // If this was the last child, the useEffect will handle redirect
    setDeletingChild(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="p-6">
        <Link
          to="/profiles"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-12">
            Manage Profiles
          </h1>

          {/* Profile grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {children.map((child) => (
              <ManageableProfileCard
                key={child.id}
                child={child}
                onEdit={() => setEditingChild(child)}
                onDelete={() => setDeletingChild(child)}
              />
            ))}
            <AddProfileCard onClick={handleAddProfile} />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingChild && (
        <EditProfileModal
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSaved={() => setEditingChild(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingChild && (
        <DeleteConfirmDialog
          child={deletingChild}
          onClose={() => setDeletingChild(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
