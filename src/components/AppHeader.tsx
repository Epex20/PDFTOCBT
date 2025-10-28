import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";

interface AppHeaderProps {
  showLogout?: boolean;
}

export const AppHeader = ({ showLogout = true }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogoClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleLogoClick}
        >
          <GraduationCap className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            PDFtoCBT
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {showLogout && user ? (
            <UserProfileDropdown />
          ) : !user ? (
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;