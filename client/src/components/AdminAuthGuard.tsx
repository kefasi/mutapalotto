import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dailyCredentials, setDailyCredentials] = useState<any>(null);
  const { toast } = useToast();

  // Check if already authenticated on component mount
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('adminAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch current admin credentials to display to user
  useEffect(() => {
    fetchDailyCredentials();
  }, []);

  const fetchDailyCredentials = async () => {
    try {
      const response = await fetch('/api/admin/credentials/current');
      if (response.ok) {
        const data = await response.json();
        setDailyCredentials(data);
      }
    } catch (error) {
      console.error('Failed to fetch daily credentials:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Test admin credentials with a simple API call
      const response = await fetch('/api/admin/stats', {
        headers: {
          'x-admin-id': adminId,
          'x-admin-password': password,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem('adminAuthenticated', 'true');
        sessionStorage.setItem('adminId', adminId);
        sessionStorage.setItem('adminPassword', password);
        
        toast({
          title: "Admin access granted",
          description: "Welcome to the admin dashboard",
        });
      } else {
        toast({
          title: "Authentication failed",
          description: "Invalid admin credentials. Please check your Admin ID and password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication error",
        description: "Failed to connect to admin services",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('adminAuthenticated');
    sessionStorage.removeItem('adminId');
    sessionStorage.removeItem('adminPassword');
    setAdminId('');
    setPassword('');
    toast({
      title: "Logged out",
      description: "Admin session ended",
    });
  };

  // If authenticated, render the admin dashboard with logout option
  if (isAuthenticated) {
    return (
      <div>
        <div className="flex justify-between items-center p-4 bg-red-900 text-white">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Admin Dashboard</span>
            <span className="text-red-200 text-sm">({adminId})</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="text-red-900 border-red-200 hover:bg-red-100"
          >
            Logout
          </Button>
        </div>
        {children}
      </div>
    );
  }

  // If not authenticated, show login form
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-red-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-red-900">Admin Access Required</CardTitle>
          <p className="text-gray-600 mt-2">
            Enter your daily admin credentials to access the dashboard
          </p>
        </CardHeader>
        <CardContent>
          {/* Display current daily credentials for reference */}
          {dailyCredentials && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Today's Credentials:</h4>
              <div className="text-sm space-y-1">
                <div><span className="font-medium">Admin ID:</span> <code className="bg-blue-100 px-2 py-1 rounded">{dailyCredentials.adminId}</code></div>
                <div><span className="font-medium">Password:</span> <code className="bg-blue-100 px-2 py-1 rounded">{dailyCredentials.password}</code></div>
                <div className="text-blue-600 mt-2 text-xs">
                  Valid until: {new Date(dailyCredentials.expiresAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="adminId">Admin ID</Label>
              <Input
                id="adminId"
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter admin ID"
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="mt-1 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? "Authenticating..." : "Access Dashboard"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Permanent Credentials:</h4>
            <div className="text-sm space-y-1">
              <div><span className="font-medium">Admin ID:</span> <code className="bg-gray-200 px-2 py-1 rounded">MUTAPA_ADMIN</code></div>
              <div><span className="font-medium">Password:</span> <code className="bg-gray-200 px-2 py-1 rounded">ZimbabweLottery2025!</code></div>
              <div className="text-gray-600 mt-2 text-xs">
                These credentials never expire
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}