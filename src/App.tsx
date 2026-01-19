import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { Layout } from './components/layout';
import {
  HomeScreen,
  WordBankScreen,
  GameScreen,
  VictoryScreen,
  GameOverScreen,
  StatisticsScreen,
  PracticeCompleteScreen,
  WildlandsHubScreen,
  LeaderboardScreen,
  CalibrationScreen,
} from './components/screens';

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          {/* Calibration - full screen without layout */}
          <Route path="calibration" element={<CalibrationScreen />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<HomeScreen />} />
            <Route path="word-bank" element={<WordBankScreen />} />
            <Route path="game" element={<GameScreen />} />
            <Route path="victory" element={<VictoryScreen />} />
            <Route path="game-over" element={<GameOverScreen />} />
            <Route path="statistics" element={<StatisticsScreen />} />
            {/* New routes for game modes */}
            <Route path="practice-complete" element={<PracticeCompleteScreen />} />
            <Route path="wildlands" element={<WildlandsHubScreen />} />
            <Route path="leaderboard/:challengeId" element={<LeaderboardScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

export default App;
