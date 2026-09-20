import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/authState';

/**
 * PublicRoute component - Redirects authenticated users away from auth pages
 * Use for login/register pages to prevent logged-in users from accessing them
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

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

  // Redirect to dashboard if already authenticated
  // If the user was redirected here from a protected route (state.from)
  // or there is a stored `postAuthRedirect` (OAuth/guest flow), allow the
  // login page to render so login logic can complete the post-auth redirect.
  const hasRedirectIntent = Boolean(location.state?.from) || Boolean(localStorage.getItem('postAuthRedirect'));

  if (isAuthenticated && !hasRedirectIntent) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render children if not authenticated
  return children;
};

export default PublicRoute;
