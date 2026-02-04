import { Shield } from 'lucide-react';

interface ParentsCardProps {
  onClick: () => void;
}

/**
 * Card for profile switcher that links to parent dashboard
 * Shows a lock/shield icon with "Parents" title and "Manage Profiles" subtext
 */
export function ParentsCard({ onClick }: ParentsCardProps) {
  return (
    <button
      onClick={onClick}
      className="
        group flex flex-col items-center justify-center gap-3 p-6
        w-36 md:w-40
        bg-gradient-to-br from-purple-900/50 to-indigo-900/50
        hover:from-purple-800/60 hover:to-indigo-800/60
        border-2 border-purple-600/50 hover:border-purple-500/70
        rounded-xl
        transition-all duration-200 ease-out
        hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20
        focus:outline-none focus:ring-2 focus:ring-purple-400/50
        min-h-[180px]
      "
    >
      <div className="w-24 h-24 rounded-full bg-purple-700/50 group-hover:bg-purple-600/60 flex items-center justify-center transition-colors">
        <Shield className="w-12 h-12 text-purple-300 group-hover:text-purple-200" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white group-hover:text-white/90">
          Parents
        </h3>
        <span className="text-sm text-purple-300/80 group-hover:text-purple-200/80">
          Manage Profiles
        </span>
      </div>
    </button>
  );
}
