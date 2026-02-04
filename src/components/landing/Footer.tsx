import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-[#0a1f10] pt-32 pb-12 mt-0">
      {/* Background Image Top Border/Decoration if needed or just full bg */}
      <div className="absolute inset-0 z-0">
        <img
          src="/landing/landing-footer-bg.png"
          alt="Jungle floor"
          className="w-full h-full object-cover object-bottom opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1f10] to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Call to Action before footer content */}
        <div className="mb-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8">
            Ready to help your child become a confident speller?
          </h2>
          <Link
            to="/signup"
            className="inline-block px-8 py-4 bg-green-500 text-white text-xl font-bold rounded-full hover:bg-green-400 transition-transform hover:-translate-y-1 shadow-lg shadow-green-900/50"
          >
            Create Free Account 🌿
          </Link>
          <p className="mt-4 text-green-200/60 text-sm">100% Free • No Credit Card Required</p>
        </div>

        <div className="border-t border-green-800/50 pt-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="text-green-50 font-bold text-xl tracking-tight">
            Alice Spelling Run
          </div>

          <div className="flex items-center gap-8 text-sm text-green-200/60">
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/contact" className="hover:text-white transition-colors">
              Contact
            </Link>
          </div>

          <div className="text-sm text-green-400/40">
            &copy; {currentYear}
          </div>
        </div>
      </div>
    </footer>
  );
}
