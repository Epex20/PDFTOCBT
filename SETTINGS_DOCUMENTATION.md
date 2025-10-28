## Test & UI Settings Feature

This feature provides a comprehensive settings system with three categories: UI settings, test settings, and misc settings.

### Installation

The feature has been installed with the following files:

1. **`src/hooks/useCbtSettings.ts`** - Custom hook for managing settings
2. **`src/components/CbtSettings.tsx`** - Settings UI component
3. **`src/pages/Settings.tsx`** - Settings page

### Usage

#### 1. Using the Hook in Your Components

```tsx
import { useCbtSettings } from '@/hooks/useCbtSettings';

function MyComponent() {
  const {
    uiSettings,
    testSettings,
    miscSettings,
    setUiSettings,
    setTestSettings,
    setMiscSettings,
    resetAllSettings,
  } = useCbtSettings();

  // Access settings
  console.log(uiSettings.theme); // 'light' | 'dark' | 'auto'
  console.log(testSettings.durationInSeconds); // 10800 (3 hours default)
  console.log(miscSettings.username);

  // Update settings
  const changeTheme = () => {
    setUiSettings({ ...uiSettings, theme: 'dark' });
  };

  return <div>...</div>;
}
```

#### 2. Settings Interface

**UI Settings:**
- `mainLayout`: 'compact' | 'comfortable' | 'spacious'
- `theme`: 'light' | 'dark' | 'auto'
- `questionPanel`: 'left' | 'right' | 'bottom'
- `questionPalette`: 'grid' | 'list' | 'compact'
- `fontSize`: 'small' | 'medium' | 'large' | 'extra-large'
- `showProgressBar`: boolean
- `showQuestionNumbers`: boolean
- `enableAnimations`: boolean

**Test Settings:**
- `testName`: string
- `timeFormat`: '12h' | '24h'
- `submitBtn`: 'always' | 'after-all-answered' | 'last-question-only'
- `durationInSeconds`: number (default: 10800 = 3 hours)
- `enableTimer`: boolean
- `showRemainingTime`: boolean
- `autoSubmitOnTimeExpiry`: boolean
- `warningBeforeExpiry`: number (in minutes)
- `allowQuestionSkip`: boolean
- `showCorrectAnswersAfterSubmit`: boolean

**Misc Settings:**
- `username`: string
- `fontSize`: number (in pixels)
- `profileImg`: string (URL)
- `imgWidth`: number
- `imgHeight`: number

#### 3. Default Values

All settings come with sensible defaults:

```tsx
import { 
  defaultUISettings, 
  defaultTestSettings, 
  defaultMiscSettings 
} from '@/hooks/useCbtSettings';
```

Default test duration is **3 hours** (10800 seconds).

#### 4. Features

✅ **Persistent Storage**: Settings are automatically saved to localStorage  
✅ **Deep Cloning**: Uses structuredClone for proper default value copying  
✅ **Reset Functions**: Individual and global reset capabilities  
✅ **Type Safety**: Full TypeScript support  
✅ **Helper Functions**: Format duration, parse duration utilities  

### Accessing the Settings Page

Navigate to `/settings` to view and modify all settings through the UI.

### Example: Applying Settings to Test Page

```tsx
import { useCbtSettings } from '@/hooks/useCbtSettings';

const Test = () => {
  const { testSettings, uiSettings } = useCbtSettings();

  // Use settings in your component
  const duration = testSettings.durationInSeconds;
  const showTimer = testSettings.enableTimer;
  const theme = uiSettings.theme;

  return (
    <div className={`theme-${theme}`}>
      {showTimer && <Timer duration={duration} />}
      {/* Rest of your test component */}
    </div>
  );
};
```

### API Reference

#### Hook Return Values

```typescript
{
  // Current settings
  uiSettings: UISettings;
  testSettings: TestSettings;
  miscSettings: MiscSettings;
  
  // Setters
  setUiSettings: (settings: UISettings) => void;
  setTestSettings: (settings: TestSettings) => void;
  setMiscSettings: (settings: MiscSettings) => void;
  
  // Reset functions
  resetAllSettings: () => void;
  resetUiSettings: () => void;
  resetTestSettings: () => void;
  resetMiscSettings: () => void;
  
  // Defaults (for reference)
  defaultUISettings: UISettings;
  defaultTestSettings: TestSettings;
  defaultMiscSettings: MiscSettings;
}
```

### Storage

Settings are stored in localStorage under the key `'cbt-settings'` and persist across sessions.
