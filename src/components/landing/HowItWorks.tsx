import { Target, Lightbulb, Zap } from 'lucide-react';

const steps = [
  {
    icon: Target,
    title: 'Quick Test',
    description: "We find your child's level with a short calibration test.",
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    icon: Lightbulb,
    title: 'Practice Mode',
    description: 'AI hints help when stuck, making learning feel natural.',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    icon: Zap,
    title: 'Chase Mode',
    description: 'Spell fast to outrun the lion! Excitement meets education.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center gap-12 mb-16">
          <div className="md:w-1/3 flex justify-center md:justify-end">
            <img
              src="/landing/character-alice-spot.png"
              alt="Alice Explorer"
              className="w-64 h-auto mix-blend-multiply filter contrast-110"
            />
          </div>
          <div className="md:w-2/3 text-center md:text-left">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              How Alice Helps <br /> <span className="text-blue-600">Kids Spell Better</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-lg mx-auto md:mx-0">
              We combine standard curriculum words with smart technology that adapts to your child's pace.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-8 sm:gap-10">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative flex flex-col items-center text-center p-8 bg-gray-50 rounded-3xl border border-gray-100 hover:border-green-200 transition-colors"
            >
              {/* Step number badge */}
              <div className="absolute -top-4 w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                {index + 1}
              </div>

              {/* Icon */}
              <div className={`w-20 h-20 ${step.bgColor} ${step.color} rounded-2xl flex items-center justify-center mb-6 mt-2`}>
                <step.icon size={40} />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {step.title}
              </h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
