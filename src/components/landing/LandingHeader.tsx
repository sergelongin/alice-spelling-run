import { Link } from 'react-router-dom';

export function LandingHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <nav className="flex items-center justify-between">
          <Link
            to="/"
            className="text-lg sm:text-2xl font-heading text-white hover:text-green-100 transition-colors drop-shadow-md tracking-wider"
          >
            Alice Spelling Run
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/login"
              className="px-3 py-2 sm:px-5 text-white font-bold font-body hover:text-green-100 transition-colors drop-shadow-md"
            >
              Log In
            </Link>
            <Link
              to="/signup"
              className="btn-juice btn-juice-green px-3 py-2 sm:px-5 text-sm sm:text-base font-bold font-heading"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
