import { Plus } from 'lucide-react';

interface AddProfileCardProps {
  onClick: () => void;
}

export function AddProfileCard({ onClick }: AddProfileCardProps) {
  return (
    <button
      onClick={onClick}
      className="
        group flex flex-col items-center justify-center gap-3 p-6
        bg-gray-800/30 hover:bg-gray-700/40
        border-2 border-dashed border-gray-600 hover:border-gray-500
        rounded-xl
        transition-all duration-200 ease-out
        hover:scale-105
        focus:outline-none focus:ring-2 focus:ring-white/50
        min-h-[180px]
      "
    >
      <div className="w-24 h-24 rounded-full bg-gray-700/50 group-hover:bg-gray-600/50 flex items-center justify-center transition-colors">
        <Plus className="w-10 h-10 text-gray-400 group-hover:text-gray-300" />
      </div>
      <span className="text-gray-400 group-hover:text-gray-300 font-medium">
        Add Profile
      </span>
    </button>
  );
}
