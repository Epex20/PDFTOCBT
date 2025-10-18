import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface AuthState {
  isAuthenticated: boolean | null;
  isLoading: boolean;
  user: any;
}

export const useAuthGuard = (redirectTo = '/auth') => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: null,
    isLoading: true,
    user: null,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth check error:', error);
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
          });
          return;
        }

        setAuthState({
          isAuthenticated: !!session,
          isLoading: false,
          user: session?.user || null,
        });

        if (!session) {
          navigate(redirectTo);
        }
      } catch (error) {
        console.error('Auth check exception:', error);
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
        });
        navigate(redirectTo);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      
      setAuthState({
        isAuthenticated: !!session,
        isLoading: false,
        user: session?.user || null,
      });

      // Redirect on logout or session expiration
      if (event === 'SIGNED_OUT' || !session) {
        navigate(redirectTo);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, redirectTo]);

  return authState;
};

export default useAuthGuard;