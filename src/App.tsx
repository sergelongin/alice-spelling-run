import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout';
import { ProtectedRoute } from './components/auth';
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
  LoginScreen,
  SignupScreen,
  ChildSetupScreen,
  ProfileSelectionScreen,
  ManageProfilesScreen,
  ParentDashboardScreen,
  ChildDetailScreen,
} from './components/screens';
import { AdminAudioScreen } from './components/admin';

// Wrapper component that connects AuthContext to GameProvider
// This enables child-specific localStorage keys for progress data isolation
function GameProviderWithChild({ children }: { children: ReactNode }) {
  const { activeChild } = useAuth();

  // Don't render GameProvider until child is selected
  // Let routing handle redirect to profile selection
  if (!activeChild) {
    return <>{children}</>;
  }

  // Key forces remount when child changes, re-initializing all localStorage reads
  // This ensures each child gets their own isolated progress data
  return (
    <GameProvider key={activeChild.id} childId={activeChild.id}>
      {children}
    </GameProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <GameProviderWithChild>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/signup" element={<SignupScreen />} />

            {/* Protected: Child setup (parents only) */}
            <Route
              path="/setup-child"
              element={
                <ProtectedRoute skipProfileRequirement>
                  <ChildSetupScreen />
                </ProtectedRoute>
              }
            />

            {/* Profile selection (Netflix-style) */}
            <Route
              path="/profiles"
              element={
                <ProtectedRoute skipProfileRequirement>
                  <ProfileSelectionScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profiles/manage"
              element={
                <ProtectedRoute skipProfileRequirement>
                  <ManageProfilesScreen />
                </ProtectedRoute>
              }
            />

            {/* Parent Dashboard routes (PIN protected, no active child required) */}
            <Route
              path="/parent-dashboard"
              element={
                <ProtectedRoute skipProfileRequirement>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ParentDashboardScreen />} />
              <Route path="child/:childId" element={<ChildDetailScreen />} />
            </Route>

            {/* Admin routes (super_admin only) */}
            <Route
              path="/admin/audio"
              element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminAudioScreen />} />
            </Route>

            {/* Calibration - full screen without layout */}
            <Route
              path="calibration"
              element={
                <ProtectedRoute requireChild>
                  <CalibrationScreen />
                </ProtectedRoute>
              }
            />

            {/* Main app routes (protected) */}
            <Route
              path="/"
              element={
                <ProtectedRoute requireChild>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeScreen />} />
              <Route path="word-bank" element={<WordBankScreen />} />
              <Route path="game" element={<GameScreen />} />
              <Route path="victory" element={<VictoryScreen />} />
              <Route path="game-over" element={<GameOverScreen />} />
              <Route path="statistics" element={<StatisticsScreen />} />
              {/* Game mode routes */}
              <Route path="practice-complete" element={<PracticeCompleteScreen />} />
              <Route path="wildlands" element={<WildlandsHubScreen />} />
              <Route path="leaderboard/:challengeId" element={<LeaderboardScreen />} />
            </Route>
          </Routes>
        </GameProviderWithChild>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
