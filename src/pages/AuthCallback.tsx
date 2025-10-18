import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get URL hash parameters (Supabase auth uses hash)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const urlParams = new URLSearchParams(window.location.search);
        
        console.log('AuthCallback - Hash params:', Object.fromEntries(hashParams));
        console.log('AuthCallback - URL params:', Object.fromEntries(urlParams));
        
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        
        if (error) {
          console.error('Auth error from URL:', error, errorDescription);
          toast({
            title: "Authentication Error",
            description: errorDescription || error,
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            toast({
              title: "Authentication Error",
              description: sessionError.message,
              variant: "destructive",
            });
            navigate('/auth');
          } else {
            toast({
              title: "Welcome!",
              description: "Successfully authenticated.",
            });
            navigate('/dashboard');
          }
        } else {
          // If no tokens in hash, check if this is an email confirmation
          const tokenHash = urlParams.get('token_hash') || urlParams.get('token');
          const type = urlParams.get('type');
          
          if (tokenHash && type) {
            // Redirect to confirm-email page to handle the token
            navigate(`/confirm-email?token_hash=${tokenHash}&type=${type}`);
          } else {
            console.log('No auth tokens found, redirecting to auth');
            navigate('/auth');
          }
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        toast({
          title: "Authentication Error",
          description: "An unexpected error occurred during authentication.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Processing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;