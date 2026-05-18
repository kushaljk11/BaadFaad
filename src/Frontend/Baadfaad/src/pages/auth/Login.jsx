/**
 * @fileoverview Login Page
 * @description Authentication page supporting:
 *              - Quick login via name (creates or finds user on backend)
 *              - Google OAuth 2.0 one-click sign-in
 *              On successful login, stores JWT & user data in localStorage
 *              via AuthContext and navigates to the dashboard.
 *
 * @module pages/auth/Login
 */
import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@root-assets/Logo-01.png';
import api from '../../config/config';
import { API_URL, BASE_URL } from '../../config/config';
import  {AuthContext}  from '../../context/authContext';

const Login = () => {
  const [fullName, setFullName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  // Determine whether the visitor was redirected here from a session or group link
  const from = location.state?.from;
  let incomingType = null;
  try {
    if (from?.search) {
      const sp = new URLSearchParams(from.search);
      incomingType = sp.get('type');
      // If the link contains a groupId param, treat it as a group link
      if (!incomingType && sp.get('groupId')) incomingType = 'group';
    }
    // Also treat explicit group paths as group links
    if (!incomingType && from?.pathname && from.pathname.includes('/group')) {
      incomingType = 'group';
    }
  } catch (e) {}
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');


  const handleGoogleLogin = () => {
    const trimmedName = fullName.trim();
    if (trimmedName) {
      localStorage.setItem('pendingFullName', trimmedName);
    } else {
      localStorage.removeItem('pendingFullName');
    }
    // Persist redirect after OAuth flow
    if (from) {
      try {
        localStorage.setItem('postAuthRedirect', JSON.stringify({ pathname: from.pathname, search: from.search }));
      } catch {}
    }
    const backendBaseUrl = BASE_URL || API_URL?.replace(/\/api\/?$/, '') || window.location.origin;
    const googleAuthUrl = `${backendBaseUrl}/api/auth/google`;
    window.location.href = googleAuthUrl;
  };

  const handleEmailLogin = async () => {
    try {
      if (!email.trim() || !password) return;
      // Persist redirect after login
      if (from) {
        try {
          localStorage.setItem('postAuthRedirect', JSON.stringify({ pathname: from.pathname, search: from.search }));
        } catch {}
      }
      const response = await api.post('/auth/login', { email: email.trim(), password });
      const { token, user } = response.data;
      login(user, token);

      // Redirect back to original location if available (or to create page)
      const stored = localStorage.getItem('postAuthRedirect');
      if (from) {
        navigate(from.pathname + (from.search || ''), { replace: true });
      } else if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localStorage.removeItem('postAuthRedirect');
          navigate(parsed.pathname + (parsed.search || ''), { replace: true });
        } catch {
          navigate('/split/create', { replace: true });
        }
      } else {
        navigate('/split/create', { replace: true });
      }
    } catch (err) {
      console.error('Email login failed', err);
    }
  };

  const handleContinue = async () => {
    try {
      const storedBefore = localStorage.getItem('postAuthRedirect');
      console.debug('Login.handleContinue: from=', from, 'postAuthRedirect=', storedBefore);

      const response = await api.post('/auth/continue', { fullName: fullName.trim() });
      console.debug('Login.handleContinue: /auth/continue response=', response.data);
      const { token, user } = response.data;
      login(user, token);

      // If redirected from a session link, auto-join the session on behalf of the user
      try {
        let targetFrom = from;
        const stored = localStorage.getItem('postAuthRedirect');
        if (!targetFrom && stored) {
          try { targetFrom = JSON.parse(stored); } catch {}
        }
        if (targetFrom?.search) {
          const sp = new URLSearchParams(targetFrom.search);
          const t = sp.get('type');
          const sessionId = sp.get('sessionId');
          const splitId = sp.get('splitId');
          if (t === 'session' && sessionId) {
              const uid = user._id || user.id;
              console.debug('Login.handleContinue: attempting auto-join', { sessionId, userId: uid });
              const joinRes = await api.post(`/session/join/${sessionId}`, { userId: uid });
              console.debug('Login.handleContinue: /session/join response=', joinRes.data);
              // navigate to joined room explicitly
              navigate(`/split/joined?splitId=${splitId}&sessionId=${sessionId}&type=${t}`, { replace: true });
              return;
            }
        }
      } catch (err) {
        // ignore join errors and fall back to redirect
        console.error('Auto-join failed:', err);
      }

      // Redirect back to original location if available
      const stored = localStorage.getItem('postAuthRedirect');
      if (from) {
        navigate(from.pathname + (from.search || ''), { replace: true });
      } else if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localStorage.removeItem('postAuthRedirect');
          navigate(parsed.pathname + (parsed.search || ''), { replace: true });
        } catch {
          navigate('/split/create', { replace: true });
        }
      } else {
        navigate('/split/create', { replace: true });
      }
    } catch (error) {
      console.error('Error continuing:', error);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card with Integrated Logo */}
        <div className="bg-white rounded-2xl shadow-lg p-8 pt-12">
          {/* Logo and Brand */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src={logo} alt="BaadFaad Logo" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-8">BaadFaad</h1>
          </div>

          <h2 className="text-2xl font-semibold text-gray-800 text-center mb-2">
            Get Started
          </h2>
          <p className="text-gray-500 text-center mb-6">
            Enter your name to continue with your account.
          </p>

          {/* Full Name Input */}
          <div className="mb-6">
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </span>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            className={`w-full text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors bg-emerald-400 hover:bg-emerald-500`}
          >
            <span className="w-6 h-6 bg-white rounded flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            </span>
            Continue with Google
          </button>
          {/* Name-only continue */}
          <div className="mt-3">
            <button
              onClick={handleContinue}
              disabled={!fullName.trim()}
              className={`w-full text-slate-700 font-medium py-3 rounded-lg border border-zinc-200 bg-white flex items-center justify-center gap-2 transition-colors ${fullName.trim() ? 'hover:bg-zinc-50' : 'opacity-60 cursor-not-allowed'}`}
            >
              Continue with name
            </button>
            {!fullName.trim() && (
              <p className="text-xs text-gray-500 mt-2 text-center">Enter your name to continue as guest.</p>
            )}
          </div>

          {/* Terms and Privacy */}
          <p className="text-center text-xs text-gray-500 mt-6">
            By continuing, you agree to our{' '}
            <a href="/terms" className="text-emerald-500 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-emerald-500 hover:underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
