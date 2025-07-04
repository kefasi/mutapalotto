import { useSession } from "@/hooks/useSession";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, isLoading } = useSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && requireAuth && !user) {
      // Redirect unauthenticated users to login
      setLocation('/login');
    }
  }, [user, isLoading, requireAuth, setLocation]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-yellow-900">
        <div className="text-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not logged in, don't render children
  if (requireAuth && !user) {
    return null;
  }

  // If user is logged in but trying to access login/register, redirect to home
  if (!requireAuth && user) {
    setLocation('/');
    return null;
  }

  return <>{children}</>;
}