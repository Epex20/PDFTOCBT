import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder button to prevent layout shift
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full opacity-0"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-9 w-9 rounded-full hover:bg-muted/80 transition-all duration-200 hover:scale-105"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-yellow-500 transition-all duration-200" />
      ) : (
        <Moon className="h-4 w-4 text-slate-600 dark:text-slate-200 transition-all duration-200" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}