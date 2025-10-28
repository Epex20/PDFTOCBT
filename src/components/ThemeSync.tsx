import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useCbtSettings } from '@/hooks/useCbtSettings';

/**
 * Component that syncs UI settings theme with the actual app theme
 */
export const ThemeSync = () => {
  const { setTheme } = useTheme();
  const { uiSettings } = useCbtSettings();

  useEffect(() => {
    // Sync theme whenever UI settings change
    if (uiSettings.theme) {
      setTheme(uiSettings.theme);
    }
  }, [uiSettings.theme, setTheme]);

  return null; // This component doesn't render anything
};
