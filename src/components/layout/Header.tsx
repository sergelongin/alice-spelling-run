import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, BarChart3 } from 'lucide-react';

export function Header() {
  const location = useLocation();

  // Don't show header during gameplay
  if (location.pathname === '/game') {
    return null;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-white/90 backdrop-blur-sm shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <nav className="flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors"
          >
            Alice Spelling Run
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/')
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Home size={20} />
              <span className="hidden sm:inline">Home</span>
            </Link>

            <Link
              to="/word-bank"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/word-bank')
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BookOpen size={20} />
              <span className="hidden sm:inline">Word Bank</span>
            </Link>

            <Link
              to="/statistics"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isActive('/statistics')
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 size={20} />
              <span className="hidden sm:inline">Stats</span>
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
