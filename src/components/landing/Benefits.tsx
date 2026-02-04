// import { Brain, Gamepad2, TrendingUp } from 'lucide-react'; // Removed unused imports

const benefits = [
  {
    imagePath: '/landing/feature-smart-practice.png',
    title: 'Smart Practice',
    shortDesc: 'Learns which mistakes your child makes and targets them',
    fullDesc: 'Alice analyzes 9 types of spelling errors - from silent letters to vowel swaps - and creates personalized practice sessions.',
    bgColor: 'bg-[#4C1D95]', // Deep Violet
    borderColor: 'border-[#5B21B6]',
    glowColor: 'shadow-purple-900/40',
  },
  {
    imagePath: '/landing/feature-fun-chase.png',
    title: 'Fun Chase',
    shortDesc: '30-second timer creates exciting urgency',
    fullDesc: "The lion is coming! Kids stay engaged with a thrilling chase mechanic that turns spelling into an adventure.",
    bgColor: 'bg-[#064E3B]', // Deep Jungle Green
    borderColor: 'border-[#065F46]',
    glowColor: 'shadow-green-900/40',
  },
  {
    imagePath: '/landing/feature-real-progress.png',
    title: 'Real Progress',
    shortDesc: 'Spaced repetition means words stick for good',
    fullDesc: 'Based on proven repetition science. Words your child struggles with come back more often until mastered.',
    bgColor: 'bg-[#1E3A8A]', // Deep Navy
    borderColor: 'border-[#1E40AF]',
    glowColor: 'shadow-blue-900/40',
  },
];

export function Benefits() {
  return (
    <section className="py-24 bg-[#FDF8E4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-4xl sm:text-5xl font-heading text-center text-[#422006] mb-4">
          Why Parents Love Alice
        </h2>
        <p className="text-xl font-body text-[#78350F] text-center mb-16 max-w-2xl mx-auto font-medium">
          Combines the engagement of a chase game with the intelligence to understand exactly where your child struggles.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className={`${benefit.bgColor} rounded-3xl p-3 shadow-2xl hover:scale-105 transition-transform duration-300 border-b-8 ${benefit.borderColor}`}
            >
              <div className="bg-black/20 rounded-2xl overflow-hidden mb-6 aspect-square w-full relative group">
                <img
                  src={benefit.imagePath}
                  alt={benefit.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="px-4 pb-8">
                <h3 className="text-2xl font-heading text-white mb-3 tracking-wide">
                  {benefit.title}
                </h3>
                <p className="text-white/90 font-body font-bold mb-4 text-lg leading-snug">
                  {benefit.shortDesc}
                </p>
                <p className="text-sm text-white/70 font-body leading-relaxed bg-black/20 p-4 rounded-xl border border-white/10">
                  {benefit.fullDesc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
