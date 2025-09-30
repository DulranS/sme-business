import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const auth = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (auth.isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.login(username, password)) {
      navigate('/admin');
    } else {
      toast({
        variant: "destructive",
        title: "Invalid credentials",
        description: "Please check your username and password",
      });
    }
  };

  return (
    <MainLayout>
      <div className="container py-16 max-w-md">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="border-b border-green-200">
            <CardTitle className="text-2xl text-center text-green-700">Admin Login</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="border-green-300 focus:border-green-500 focus:ring-green-500"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-green-300 focus:border-green-500 focus:ring-green-500"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}