import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useToast } from "@/hooks/use-toast";

const ConfirmEmail = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Get the URL hash which contains the auth information
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlParams = new URLSearchParams(window.location.search);
        
        console.log('Hash params:', Object.fromEntries(hashParams));
        console.log('URL params:', Object.fromEntries(urlParams));
        
        // Check for access_token in hash (typical for email confirmations)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenType = hashParams.get('token_type');
        const type = hashParams.get('type') || urlParams.get('type');
        
        // Also check URL params for token_hash
        const tokenHash = urlParams.get('token_hash') || urlParams.get('token');
        
        if (accessToken && refreshToken) {
          // Handle successful email confirmation with tokens
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('Session error:', error);
            setError(error.message);
          } else {
            setConfirmed(true);
            toast({
              title: "Email confirmed!",
              description: "Your account has been verified successfully.",
            });
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          }
        } else if (tokenHash && type === 'signup') {
          // Handle token hash verification
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'email'
          });

          if (error) {
            console.error('Token verification error:', error);
            setError(error.message);
          } else {
            setConfirmed(true);
            toast({
              title: "Email confirmed!",
              description: "Your account has been verified successfully.",
            });
            
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          }
        } else {
          console.log('No valid auth tokens found');
          setError('Invalid confirmation link or tokens not found');
        }
      } catch (err: any) {
        console.error('Confirmation error:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    handleEmailConfirmation();
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-hero)]">
        <AppHeader showLogout={false} />
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl font-bold">
                  Confirming Email
                </CardTitle>
                <CardDescription>
                  Please wait while we verify your email address...
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--gradient-hero)]">
        <AppHeader showLogout={false} />
        <div className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20">
                    <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-red-700 dark:text-red-400">
                  Confirmation Failed
                </CardTitle>
                <CardDescription>
                  {error}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>This could happen if:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>The confirmation link has expired</li>
                    <li>The link has already been used</li>
                    <li>The link was corrupted in your email</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={() => navigate('/auth')}
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                  <Button 
                    onClick={() => navigate('/')}
                    variant="outline"
                    className="w-full"
                  >
                    Go to Homepage
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <AppHeader showLogout={false} />
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
                  <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
                Email Confirmed!
              </CardTitle>
              <CardDescription>
                Your account has been successfully verified
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                  🎉 Welcome to PDFtoCBT! You'll be redirected to your dashboard in a moment.
                </p>
              </div>
              <Button 
                onClick={() => navigate('/dashboard')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConfirmEmail;