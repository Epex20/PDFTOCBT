import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useCbtSettings, formatDuration } from '@/hooks/useCbtSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Palette, Timer, User, RotateCcw, Save, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export const CbtSettings = () => {
  const {
    uiSettings,
    testSettings,
    miscSettings,
    setUiSettings,
    setTestSettings,
    setMiscSettings,
    resetAllSettings,
    resetUiSettings,
    resetTestSettings,
    resetMiscSettings,
  } = useCbtSettings();

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('ui');
  const [isSaving, setIsSaving] = useState(false);

  // Duration state for easier editing
  const [hours, setHours] = useState(Math.floor(testSettings.durationInSeconds / 3600));
  const [minutes, setMinutes] = useState(Math.floor((testSettings.durationInSeconds % 3600) / 60));
  const [seconds, setSeconds] = useState(testSettings.durationInSeconds % 60);

  // Sync theme on mount and when uiSettings.theme changes
  useEffect(() => {
    if (uiSettings.theme && theme !== uiSettings.theme) {
      setTheme(uiSettings.theme);
    }
  }, [uiSettings.theme, theme, setTheme]);

  // Update duration state when testSettings changes externally (e.g., from reset)
  useEffect(() => {
    setHours(Math.floor(testSettings.durationInSeconds / 3600));
    setMinutes(Math.floor((testSettings.durationInSeconds % 3600) / 60));
    setSeconds(testSettings.durationInSeconds % 60);
  }, [testSettings.durationInSeconds]);

  const handleDurationChange = (newHours: number, newMinutes: number, newSeconds: number) => {
    // Validate and clamp values
    const clampedHours = Math.max(0, Math.min(23, newHours));
    const clampedMinutes = Math.max(0, Math.min(59, newMinutes));
    const clampedSeconds = Math.max(0, Math.min(59, newSeconds));
    
    setHours(clampedHours);
    setMinutes(clampedMinutes);
    setSeconds(clampedSeconds);
    
    const totalSeconds = (clampedHours * 3600) + (clampedMinutes * 60) + clampedSeconds;
    
    // Ensure at least 1 second
    if (totalSeconds === 0) {
      toast({
        title: "Invalid duration",
        description: "Test duration must be at least 1 second.",
        variant: "destructive",
      });
      return;
    }
    
    setTestSettings({ ...testSettings, durationInSeconds: totalSeconds });
  };

  const handleSave = () => {
    setIsSaving(true);
    
    // Simulate save operation (settings are already saved via useEffect in the hook)
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    }, 300);
  };

  const handleResetAll = () => {
    resetAllSettings();
    // Reset will trigger useEffect to update duration fields
    toast({
      title: "Settings reset",
      description: "All settings have been restored to defaults.",
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Test & UI Settings</h1>
            <p className="text-muted-foreground">
              Customize your test experience and interface preferences
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs">
          Auto-Saved
        </Badge>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Settings are automatically saved</h3>
              <p className="text-sm text-muted-foreground">
                Your preferences are stored in your browser and will persist across sessions. 
                Click "Save All Changes" to see a confirmation, or use reset buttons to restore defaults.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ui" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            UI Settings
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Test Settings
          </TabsTrigger>
          <TabsTrigger value="misc" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Misc Settings
          </TabsTrigger>
        </TabsList>

        {/* UI Settings Tab */}
        <TabsContent value="ui" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>UI Settings</CardTitle>
              <CardDescription>Customize the appearance and layout of your test interface</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">

                {/* Theme */}
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={uiSettings.theme}
                    onValueChange={(value: 'light' | 'dark' | 'auto') => {
                      setUiSettings({ ...uiSettings, theme: value });
                      setTheme(value === 'auto' ? 'system' : value); // Apply theme immediately
                    }}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">Auto (System)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Current: {theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
                  </p>
                </div>

                {/* Question Panel */}
                <div className="space-y-2">
                  <Label htmlFor="questionPanel">Question Panel Position</Label>
                  <Select
                    value={uiSettings.questionPanel}
                    onValueChange={(value: 'left' | 'right' | 'bottom') =>
                      setUiSettings({ ...uiSettings, questionPanel: value })
                    }
                  >
                    <SelectTrigger id="questionPanel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Question Palette */}
                <div className="space-y-2">
                  <Label htmlFor="questionPalette">Question Palette Style</Label>
                  <Select
                    value={uiSettings.questionPalette}
                    onValueChange={(value: 'grid' | 'list' | 'compact') =>
                      setUiSettings({ ...uiSettings, questionPalette: value })
                    }
                  >
                    <SelectTrigger id="questionPalette">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid</SelectItem>
                      <SelectItem value="list">List</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Toggle Settings */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showProgressBar" className="cursor-pointer">
                    Show Progress Bar
                  </Label>
                  <Switch
                    id="showProgressBar"
                    checked={uiSettings.showProgressBar}
                    onCheckedChange={(checked) =>
                      setUiSettings({ ...uiSettings, showProgressBar: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showQuestionNumbers" className="cursor-pointer">
                    Show Question Numbers
                  </Label>
                  <Switch
                    id="showQuestionNumbers"
                    checked={uiSettings.showQuestionNumbers}
                    onCheckedChange={(checked) =>
                      setUiSettings({ ...uiSettings, showQuestionNumbers: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enableAnimations" className="cursor-pointer">
                    Enable Animations
                  </Label>
                  <Switch
                    id="enableAnimations"
                    checked={uiSettings.enableAnimations}
                    onCheckedChange={(checked) =>
                      setUiSettings({ ...uiSettings, enableAnimations: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={resetUiSettings} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset UI Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Settings Tab */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test Settings</CardTitle>
              <CardDescription>Configure test behavior and time controls. Default test duration: 3 hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Name */}
              <div className="space-y-2">
                <Label htmlFor="testName">Test Name</Label>
                <Input
                  id="testName"
                  value={testSettings.testName}
                  onChange={(e) => setTestSettings({ ...testSettings, testName: e.target.value })}
                  placeholder="Enter test name"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Time Format */}
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Select
                    value={testSettings.timeFormat}
                    onValueChange={(value: '12h' | '24h') =>
                      setTestSettings({ ...testSettings, timeFormat: value })
                    }
                  >
                    <SelectTrigger id="timeFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12 Hour</SelectItem>
                      <SelectItem value="24h">24 Hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit Button */}
                <div className="space-y-2">
                  <Label htmlFor="submitBtn">Submit Button Display</Label>
                  <Select
                    value={testSettings.submitBtn}
                    onValueChange={(value: 'always' | 'after-all-answered' | 'last-question-only') =>
                      setTestSettings({ ...testSettings, submitBtn: value })
                    }
                  >
                    <SelectTrigger id="submitBtn">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always">Always Show</SelectItem>
                      <SelectItem value="after-all-answered">After All Answered</SelectItem>
                      <SelectItem value="last-question-only">Last Question Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Test Duration</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="hours" className="text-xs text-muted-foreground">Hours</Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      max="23"
                      value={hours}
                      onChange={(e) => handleDurationChange(parseInt(e.target.value) || 0, minutes, seconds)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="minutes" className="text-xs text-muted-foreground">Minutes</Label>
                    <Input
                      id="minutes"
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => handleDurationChange(hours, parseInt(e.target.value) || 0, seconds)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="seconds" className="text-xs text-muted-foreground">Seconds</Label>
                    <Input
                      id="seconds"
                      type="number"
                      min="0"
                      max="59"
                      value={seconds}
                      onChange={(e) => handleDurationChange(hours, minutes, parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: {formatDuration(testSettings.durationInSeconds)} ({testSettings.durationInSeconds} seconds)
                </p>
              </div>

              {/* Warning Before Expiry */}
              <div className="space-y-2">
                <Label htmlFor="warningBeforeExpiry">Warning Before Expiry (minutes)</Label>
                <Input
                  id="warningBeforeExpiry"
                  type="number"
                  min="0"
                  max={Math.floor(testSettings.durationInSeconds / 60)}
                  value={testSettings.warningBeforeExpiry}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    const maxWarning = Math.floor(testSettings.durationInSeconds / 60);
                    const clampedValue = Math.max(0, Math.min(maxWarning, value));
                    setTestSettings({ ...testSettings, warningBeforeExpiry: clampedValue });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Show warning {testSettings.warningBeforeExpiry} minute(s) before test ends
                </p>
              </div>

              {/* Toggle Settings */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableTimer" className="cursor-pointer">
                    Enable Timer
                  </Label>
                  <Switch
                    id="enableTimer"
                    checked={testSettings.enableTimer}
                    onCheckedChange={(checked) =>
                      setTestSettings({ ...testSettings, enableTimer: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showRemainingTime" className="cursor-pointer">
                    Show Remaining Time
                  </Label>
                  <Switch
                    id="showRemainingTime"
                    checked={testSettings.showRemainingTime}
                    onCheckedChange={(checked) =>
                      setTestSettings({ ...testSettings, showRemainingTime: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="autoSubmitOnTimeExpiry" className="cursor-pointer">
                    Auto Submit on Time Expiry
                  </Label>
                  <Switch
                    id="autoSubmitOnTimeExpiry"
                    checked={testSettings.autoSubmitOnTimeExpiry}
                    onCheckedChange={(checked) =>
                      setTestSettings({ ...testSettings, autoSubmitOnTimeExpiry: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="allowQuestionSkip" className="cursor-pointer">
                    Allow Question Skip
                  </Label>
                  <Switch
                    id="allowQuestionSkip"
                    checked={testSettings.allowQuestionSkip}
                    onCheckedChange={(checked) =>
                      setTestSettings({ ...testSettings, allowQuestionSkip: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="showCorrectAnswersAfterSubmit" className="cursor-pointer">
                    Show Correct Answers After Submit
                  </Label>
                  <Switch
                    id="showCorrectAnswersAfterSubmit"
                    checked={testSettings.showCorrectAnswersAfterSubmit}
                    onCheckedChange={(checked) =>
                      setTestSettings({ ...testSettings, showCorrectAnswersAfterSubmit: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={resetTestSettings} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset Test Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Misc Settings Tab */}
        <TabsContent value="misc" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Misc Settings</CardTitle>
              <CardDescription>User profile and miscellaneous preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={miscSettings.username}
                  onChange={(e) => setMiscSettings({ ...miscSettings, username: e.target.value })}
                  placeholder="Enter your username"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">

                {/* Profile Image URL */}
                <div className="space-y-2">
                  <Label htmlFor="profileImg">Profile Image URL</Label>
                  <Input
                    id="profileImg"
                    value={miscSettings.profileImg}
                    onChange={(e) => setMiscSettings({ ...miscSettings, profileImg: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                {/* Image Width */}
                <div className="space-y-2">
                  <Label htmlFor="imgWidth">Profile Image Width (px)</Label>
                  <Input
                    id="imgWidth"
                    type="number"
                    min="50"
                    max="500"
                    value={miscSettings.imgWidth}
                    onChange={(e) =>
                      setMiscSettings({ ...miscSettings, imgWidth: parseInt(e.target.value) || 100 })
                    }
                  />
                </div>

                {/* Image Height */}
                <div className="space-y-2">
                  <Label htmlFor="imgHeight">Profile Image Height (px)</Label>
                  <Input
                    id="imgHeight"
                    type="number"
                    min="50"
                    max="500"
                    value={miscSettings.imgHeight}
                    onChange={(e) =>
                      setMiscSettings({ ...miscSettings, imgHeight: parseInt(e.target.value) || 100 })
                    }
                  />
                </div>
              </div>

              {/* Profile Image Preview */}
              {miscSettings.profileImg && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>Profile Image Preview</Label>
                  <div className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg gap-2">
                    <img
                      src={miscSettings.profileImg}
                      alt="Profile preview"
                      style={{
                        width: `${miscSettings.imgWidth}px`,
                        height: `${miscSettings.imgHeight}px`,
                      }}
                      className="object-cover rounded-full border-2 border-border shadow-md"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(miscSettings.username || 'User')}&size=200&background=random`;
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {miscSettings.imgWidth} × {miscSettings.imgHeight} pixels
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={resetMiscSettings} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset Misc Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="destructive" onClick={handleResetAll} className="gap-2" disabled={isSaving}>
          <RotateCcw className="w-4 h-4" />
          Reset All Settings
        </Button>
        <Button onClick={handleSave} className="gap-2" disabled={isSaving}>
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
