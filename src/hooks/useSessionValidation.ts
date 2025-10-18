import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/auth'];

export const useSessionValidation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const validateSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session validation error:', error);
          if (!PUBLIC_ROUTES.includes(location.pathname)) {
            navigate('/auth');
          }
          return;
        }

        // If no session and trying to access protected route, redirect to auth
        if (!session && !PUBLIC_ROUTES.includes(location.pathname)) {
          navigate('/auth');
          return;
        }

        // If has session and trying to access public routes (except home), redirect to dashboard
        if (session && (location.pathname === '/auth')) {
          navigate('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Session validation exception:', error);
        if (!PUBLIC_ROUTES.includes(location.pathname)) {
          navigate('/auth');
        }
      }
    };

    validateSession();

    // Periodic session validation (every 30 seconds)
    const interval = setInterval(validateSession, 30000);

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed in session validator:', event, !!session);
      
      if (event === 'SIGNED_OUT' || !session) {
        if (!PUBLIC_ROUTES.includes(location.pathname)) {
          navigate('/auth');
        }
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);
};

export default useSessionValidation;