import { useState, useEffect } from 'react';

// UI Settings Interface
export interface UISettings {
  mainLayout: 'compact' | 'comfortable' | 'spacious';
  theme: 'light' | 'dark' | 'auto';
  questionPanel: 'left' | 'right' | 'bottom';
  questionPalette: 'grid' | 'list' | 'compact';
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  showProgressBar: boolean;
  showQuestionNumbers: boolean;
  enableAnimations: boolean;
}

// Test Settings Interface
export interface TestSettings {
  testName: string;
  timeFormat: '12h' | '24h';
  submitBtn: 'always' | 'after-all-answered' | 'last-question-only';
  durationInSeconds: number; // 3*60*60 = 10800 seconds (3 hours default)
  enableTimer: boolean;
  showRemainingTime: boolean;
  autoSubmitOnTimeExpiry: boolean;
  warningBeforeExpiry: number; // in minutes
  allowQuestionSkip: boolean;
  showCorrectAnswersAfterSubmit: boolean;
}

// Misc Settings Interface
export interface MiscSettings {
  username: string;
  fontSize: number;
  profileImg: string;
  imgWidth: number;
  imgHeight: number;
}

// Combined Settings Interface
export interface CbtSettings {
  uiSettings: UISettings;
  testSettings: TestSettings;
  miscSettings: MiscSettings;
}

// Default UI Settings
export const defaultUISettings: UISettings = {
  mainLayout: 'comfortable',
  theme: 'auto',
  questionPanel: 'right',
  questionPalette: 'grid',
  fontSize: 'medium',
  showProgressBar: true,
  showQuestionNumbers: true,
  enableAnimations: true,
};

// Default Test Settings (3 hours default duration)
export const defaultTestSettings: TestSettings = {
  testName: 'New Test',
  timeFormat: '24h',
  submitBtn: 'always',
  durationInSeconds: 3 * 60 * 60, // 3 hours
  enableTimer: true,
  showRemainingTime: true,
  autoSubmitOnTimeExpiry: true,
  warningBeforeExpiry: 5, // 5 minutes warning
  allowQuestionSkip: true,
  showCorrectAnswersAfterSubmit: false,
};

// Default Misc Settings
export const defaultMiscSettings: MiscSettings = {
  username: '',
  fontSize: 16,
  profileImg: '',
  imgWidth: 100,
  imgHeight: 100,
};

// Default Combined Settings
export const defaultCbtSettings: CbtSettings = {
  uiSettings: defaultUISettings,
  testSettings: defaultTestSettings,
  miscSettings: defaultMiscSettings,
};

// Deep clone utility using structuredClone
const structuredClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

// Local Storage Key
const STORAGE_KEY = 'cbt-settings';

/**
 * Custom hook for managing CBT settings
 * Returns useState with default values
 * Persists settings to localStorage
 */
export const useCbtSettings = () => {
  // Load settings from localStorage or use defaults
  const loadSettings = (): CbtSettings => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return {
          uiSettings: { ...defaultUISettings, ...parsed.uiSettings },
          testSettings: { ...defaultTestSettings, ...parsed.testSettings },
          miscSettings: { ...defaultMiscSettings, ...parsed.miscSettings },
        };
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
    return structuredClone(defaultCbtSettings);
  };

  const [uiSettings, setUiSettings] = useState<UISettings>(() => 
    structuredClone(loadSettings().uiSettings)
  );
  
  const [testSettings, setTestSettings] = useState<TestSettings>(() => 
    structuredClone(loadSettings().testSettings)
  );
  
  const [miscSettings, setMiscSettings] = useState<MiscSettings>(() => 
    structuredClone(loadSettings().miscSettings)
  );

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      const settings: CbtSettings = {
        uiSettings,
        testSettings,
        miscSettings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, [uiSettings, testSettings, miscSettings]);

  // Reset all settings to defaults
  const resetAllSettings = () => {
    setUiSettings(structuredClone(defaultUISettings));
    setTestSettings(structuredClone(defaultTestSettings));
    setMiscSettings(structuredClone(defaultMiscSettings));
  };

  // Reset individual setting categories
  const resetUiSettings = () => setUiSettings(structuredClone(defaultUISettings));
  const resetTestSettings = () => setTestSettings(structuredClone(defaultTestSettings));
  const resetMiscSettings = () => setMiscSettings(structuredClone(defaultMiscSettings));

  return {
    // State
    uiSettings,
    testSettings,
    miscSettings,
    
    // Setters
    setUiSettings,
    setTestSettings,
    setMiscSettings,
    
    // Reset functions
    resetAllSettings,
    resetUiSettings,
    resetTestSettings,
    resetMiscSettings,
    
    // Defaults
    defaultUISettings,
    defaultTestSettings,
    defaultMiscSettings,
  };
};

// Helper function to format duration
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

// Helper function to parse duration string to seconds
export const parseDuration = (hours: number, minutes: number, seconds: number): number => {
  return (hours * 3600) + (minutes * 60) + seconds;
};
