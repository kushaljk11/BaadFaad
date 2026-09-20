/**
 * @fileoverview Application Root Component
 * @description Defines the top-level React component tree for BaadFaad.
 *              Wraps everything in AuthProvider for global auth state,
 *              sets up React Router with public routes (landing, about, contact, login)
 *              and protected routes (dashboard, splits, groups, settlements).
 *              Shows a full-screen loader while auth state is being resolved.
 *
 * @module App
 */
import './App.css'
import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Landing from './pages/landing/Landing'
import { AuthProvider } from './context/authContext'
import { useAuth } from './context/authState'
import ProtectedRoute from './components/common/ProtectedRoute'
import PublicRoute from './components/common/PublicRoute'
import Loader from './components/common/Loader'
import useNetworkStatus from './hooks/useNetworkStatus'
import { ErrorBoundary, OfflineBanner } from './components/common/primitives'

const AboutUs = lazy(() => import('./pages/landing/AboutUs'))
const Contact = lazy(() => import('./pages/landing/Contact'))
const Home = lazy(() => import('./pages/Dashboard/Home'))
const CreateSplit = lazy(() => import('./pages/split/CreateSplit'))
const ScanBill = lazy(() => import('./pages/split/ScanBill'))
const ReadyToSplit = lazy(() => import('./pages/split/ReadyToSplit'))
const JoinedParticipants = lazy(() => import('./pages/split/JoinedParticipants'))
const SplitBreakdown = lazy(() => import('./pages/split/SplitBreakdown'))
const SplitCalculated = lazy(() => import('./pages/split/SplitCalculated'))
const Settlement = lazy(() => import('./pages/group/Settelment'))
const Nudge = lazy(() => import('./pages/group/Nudge'))
const Group = lazy(() => import('./pages/group/Group'))
const Login = lazy(() => import('./pages/auth/Login'))
const JoinSession = lazy(() => import('./pages/Dashboard/JoinSession'))
const JoinSplit = lazy(() => import('./pages/split/JoinSplit'))
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'))
const PaymentForm = lazy(() => import('./components/layout/Payment/paymentForm'))
const PaymentSuccess = lazy(() => import('./components/layout/Payment/success'))
const PaymentFailure = lazy(() => import('./components/layout/Payment/failure'))

const LOADER = (
  <div className="flex min-h-screen items-center justify-center bg-slate-900">
    <Loader className="size-10 animate-spin text-emerald-400" />
  </div>
)

function AppContent() {
  const { isLoading } = useAuth();
  const isOnline = useNetworkStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <Loader className="size-10 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      {!isOnline && <OfflineBanner />}
      <Router>
        <ErrorBoundary>
          <Suspense fallback={LOADER}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Protected Routes - Require Authentication */}
              <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/join-session" element={<ProtectedRoute><JoinSession /></ProtectedRoute>} />
              <Route path="/split/join" element={<ProtectedRoute><JoinSplit /></ProtectedRoute>} />
              <Route path="/group/join" element={<ProtectedRoute><JoinSplit /></ProtectedRoute>} />
              <Route path="/session/join" element={<ProtectedRoute><JoinSplit /></ProtectedRoute>} />
              <Route path="/split/create" element={<ProtectedRoute><CreateSplit /></ProtectedRoute>} />
              <Route path="/split/scan" element={<ProtectedRoute><ScanBill /></ProtectedRoute>} />
              <Route path="/split/ready" element={<ProtectedRoute><ReadyToSplit /></ProtectedRoute>} />
              <Route path="/split/joined" element={<ProtectedRoute><JoinedParticipants /></ProtectedRoute>} />
              <Route path="/split/breakdown" element={<ProtectedRoute><SplitBreakdown /></ProtectedRoute>} />
              <Route path="/split/calculated" element={<ProtectedRoute><SplitCalculated /></ProtectedRoute>} />
              <Route path="/split/settlement" element={<ProtectedRoute><Settlement /></ProtectedRoute>} />
              <Route path="/payment" element={<ProtectedRoute><PaymentForm /></ProtectedRoute>} />
              <Route path="/payment-success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
              <Route path="/payment-failure" element={<ProtectedRoute><PaymentFailure /></ProtectedRoute>} />
              <Route path="/group" element={<ProtectedRoute><Group /></ProtectedRoute>} />
              <Route path="/group/:groupId/settlement" element={<ProtectedRoute><Settlement /></ProtectedRoute>} />
              <Route path="/group/:groupId/nudge" element={<ProtectedRoute><Nudge /></ProtectedRoute>} />
              <Route path="/group/details" element={<ProtectedRoute><Group /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App
