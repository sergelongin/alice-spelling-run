import { useNavigate, Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ProfileCard, AddProfileCard } from '@/components/profiles';

export function ProfileSelectionScreen() {
  const { children, activeChild, selectProfile } = useAuth();
  const navigate = useNavigate();

  const handleSelectProfile = (childId: string) => {
    selectProfile(childId);
    navigate('/', { replace: true });
  };

  const handleAddProfile = () => {
    navigate('/setup-child');
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
            <AddProfileCard onClick={handleAddProfile} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 flex justify-center">
        <Link
          to="/profiles/manage"
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
        >
          <Settings size={18} />
          <span>Manage Profiles</span>
        </Link>
      </div>
    </div>
  );
}
