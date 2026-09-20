import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authState';
import { useMemo } from 'react';

/**
 * ProtectedRoute component - Prevents unauthorized access to protected pages
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-emerald-400 border-r-transparent"></div>
          <p className="mt-4 text-zinc-100">Loading...</p>
        </div>
      </div>
    );
  }

  // Allow unauthenticated access for session join URLs
  const pathname = location.pathname || '';
  const flowType = String(searchParams.get('type') || '').toLowerCase();
  const hasSessionContext = Boolean(searchParams.get('sessionId')) || flowType === 'session';

  // Allow guests to stay in the real-time session flow when host navigates.
  const publicSessionPaths = new Set([
    '/session/join',
    '/split/join',
    '/split/ready',
    '/split/joined',
    '/split/scan',
    '/split/breakdown',
    '/split/calculated',
  ]);

  const isPublicSessionLink =
    publicSessionPaths.has(pathname) &&
    hasSessionContext;

  const userEmail = String(user?.email || '').toLowerCase();
  const isOAuthUser = Boolean(userEmail) && !userEmail.endsWith('@local');
  const isGroupPath = pathname === '/group' || pathname.startsWith('/group/');

  if (!isAuthenticated && !isPublicSessionLink) {
    // Redirect to login, preserving the intended location for post-login redirect
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isGroupPath && (!isAuthenticated || !isOAuthUser)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Render children if authenticated
  return children;
};

export default ProtectedRoute;
