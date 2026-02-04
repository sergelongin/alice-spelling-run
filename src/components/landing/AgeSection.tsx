import { BookOpen, MessageSquare, Trophy } from 'lucide-react';

const features = [
  {
    icon: BookOpen,
    text: '665+ grade-level words (Grades 3-6)',
  },
  {
    icon: MessageSquare,
    text: 'AI hints that explain, not just correct',
  },
  {
    icon: Trophy,
    text: 'Trophy system that rewards persistence',
  },
];

export function AgeSection() {
  return (
    <section className="py-24 bg-[#e8e1d0] relative overflow-hidden">
      {/* Background Map Texture/Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#8B4513 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-amber-100/80 text-amber-800 text-sm font-bold uppercase tracking-wider rounded-full border-2 border-amber-800/20 mb-6 shadow-sm transform -rotate-2">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></span>
            Ages 9-12
          </div>

          <h2 className="text-4xl sm:text-5xl font-extrabold text-amber-900 mb-6 font-serif tracking-tight">
            Built for Growing Spellers
          </h2>

          <p className="text-lg sm:text-xl text-amber-800/80 max-w-2xl mx-auto leading-relaxed">
            No baby games. No boring drills. Just the right challenge for kids who are ready to level up their spelling.
          </p>
        </div>

        {/* Map Container */}
        <div className="relative max-w-4xl mx-auto">
          {/* Dotted Path SVG - Hidden on mobile, visible on desktop */}
          <svg className="hidden md:block absolute top-1/2 left-0 w-full h-24 -translate-y-1/2 z-0 pointer-events-none" viewBox="0 0 800 100" preserveAspectRatio="none">
            <path d="M 50 50 Q 200 100 400 50 T 750 50" fill="none" stroke="#B45309" strokeWidth="4" strokeDasharray="12 8" strokeLinecap="round" className="opacity-40" />
          </svg>

          <div className="grid md:grid-cols-3 gap-8 relative z-10">
            {features.map((feature) => (
              <div
                key={feature.text}
                className="flex flex-col items-center text-center transform transition-transform hover:-translate-y-2 duration-300"
              >
                {/* Map Node/Icon */}
                <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center shadow-xl border-4 border-amber-200 mb-6 relative group">
                  <feature.icon size={32} className="text-white drop-shadow-md" />
                  {/* Checkmark badge */}
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-[#e8e1d0] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-amber-900/10 w-full hover:border-amber-500/30 transition-colors">
                  <span className="text-lg font-bold text-gray-800 leading-snug">
                    {feature.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div> {/* End Map Panel */}
      </div>
    </section>
  );
}
