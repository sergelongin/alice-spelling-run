import { Link } from 'react-router-dom';

export function HeroSection() {
  return (
    <section className="relative h-[600px] lg:h-[800px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="/landing/landing-hero-bg.png"
          alt="Jungle adventure background"
          className="w-full h-full object-cover object-bottom"
        />
        {/* Top overlay gradient for header visibility */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-10" />
        {/* Overlay gradient for text readability if needed */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent lg:from-black/10" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-center">
        <div className="max-w-xl lg:max-w-2xl text-center lg:text-left pt-20 lg:pt-0">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 drop-shadow-lg tracking-tight leading-tight">
            Make Spelling an <br />
            <span className="text-yellow-300 drop-shadow-md">Adventure!</span>
          </h1>
          <p className="text-xl sm:text-2xl text-white/95 mb-10 font-medium drop-shadow-md max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Your child runs, spells, and escapes the lion in a game that actually teaches.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              to="/signup"
              className="px-8 py-4 bg-green-600 border-b-4 border-green-800 text-white text-xl font-bold rounded-2xl hover:bg-green-500 hover:border-green-700 transition-all shadow-xl hover:-translate-y-1 active:translate-y-0 active:border-b-0"
            >
              Start Playing Free 🌿
            </Link>
            {/* <Link
              to="/login"
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white text-lg font-bold rounded-2xl hover:bg-white/20 transition-all"
            >
              Log In
            </Link> */}
          </div>
        </div>
      </div>
    </section>
  );
}
