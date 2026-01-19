import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { HomeBackground } from './HomeBackground';
import { HomeCharacterScene } from './HomeCharacterScene';
import { PlayButton } from './PlayButton';

export function NewUserWelcome() {
  const navigate = useNavigate();

  const handleStartCalibration = () => {
    navigate('/calibration?phase=playing');
  };

  const handleKnowMyLevel = () => {
    navigate('/calibration?phase=grade-select');
  };

  return (
    <HomeBackground>
      <div className="flex flex-col items-center px-6 pt-8 pb-32">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
            <Sparkles className="text-amber-500" size={32} />
            Alice Spelling Run
            <Sparkles className="text-amber-500" size={32} />
          </h1>
          <p className="text-lg text-amber-700 font-semibold">
            Spell to Survive!
          </p>
        </div>

        {/* Character scene */}
        <HomeCharacterScene
          mood="tense"
          showSpeechBubble={true}
          speechText="Help! The lion is getting closer!"
        />

        {/* Story introduction panel */}
        <div className="bg-white/90 backdrop-blur rounded-2xl p-6 max-w-md w-full shadow-xl border border-amber-100 mb-6">
          <div className="space-y-4 text-center">
            <p className="text-gray-700">
              Alice loves exploring the savannah, but there's one problem...
            </p>
            <p className="text-amber-700 font-bold text-lg">
              A hungry lion is always chasing her!
            </p>
            <p className="text-gray-700">
              The only way Alice can escape is by{' '}
              <span className="font-bold text-blue-600">spelling words correctly</span>.
              Every right answer makes her run faster!
            </p>
          </div>
        </div>

        {/* Calibration CTA */}
        <div className="text-center mb-6">
          <p className="text-gray-600 text-sm mb-4">
            Let's discover your spelling level so we can pick the perfect words for you!
          </p>
          <PlayButton
            label="Start Level Adventure"
            sublabel="Quick spelling check"
            onClick={handleStartCalibration}
            variant="adventure"
            size="large"
          />
        </div>

        {/* Alternative option */}
        <button
          onClick={handleKnowMyLevel}
          className="text-gray-500 hover:text-gray-700 text-sm underline underline-offset-2 transition-colors"
        >
          I already know my level
        </button>
      </div>
    </HomeBackground>
  );
}
