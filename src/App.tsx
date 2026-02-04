import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContextDB';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout';
import { ProtectedRoute } from './components/auth';
import { useLaunchDarklyIdentify } from './hooks/useLaunchDarklyIdentify';
import {
  HomeScreen,
  LandingPage,
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
  PinSetupScreen,
  ProfileSelectionScreen,
  ParentDashboardScreen,
  ChildDetailScreen,
  ChildSessionHistoryScreen,
  ChildWordBankScreen,
  LevelMapScreen,
} from './components/screens';
import { AdminAudioScreen } from './components/admin';

// Wrapper component that connects AuthContext to GameProvider
// This enables child-specific data isolation using WatermelonDB
function GameProviderWithChild({ children }: { children: ReactNode }) {
  const { activeChild } = useAuth();

  // Identify user to LaunchDarkly for feature flags and analytics
  useLaunchDarklyIdentify();

  // Don't render GameProvider until child is selected
  // Let routing handle redirect to profile selection
  if (!activeChild) {
    return <>{children}</>;
  }

  // Key forces remount when child changes, re-initializing database queries
  // This ensures each child gets their own isolated progress data
  // Sync is built into GameProvider (WatermelonDB version)
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
            {/* Public landing page */}
            <Route path="/" element={<LandingPage />} />

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

            {/* Protected: PIN setup (after child setup) */}
            <Route
              path="/setup-pin"
              element={
                <ProtectedRoute skipProfileRequirement>
                  <PinSetupScreen />
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
            {/* Redirect old manage profiles route to parent dashboard */}
            <Route
              path="/profiles/manage"
              element={<Navigate to="/parent-dashboard" replace />}
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
              <Route path="child/:childId/sessions" element={<ChildSessionHistoryScreen />} />
              <Route path="child/:childId/word-bank" element={<ChildWordBankScreen />} />
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

            {/* Protected home route */}
            <Route
              path="/home"
              element={
                <ProtectedRoute requireChild>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeScreen />} />
            </Route>

            {/* Main app routes (protected) - Layout wraps each route */}
            <Route
              element={
                <ProtectedRoute requireChild>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="word-bank" element={<WordBankScreen />} />
              <Route path="game" element={<GameScreen />} />
              <Route path="victory" element={<VictoryScreen />} />
              <Route path="game-over" element={<GameOverScreen />} />
              <Route path="statistics" element={<StatisticsScreen />} />
              <Route path="level-map" element={<LevelMapScreen />} />
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
