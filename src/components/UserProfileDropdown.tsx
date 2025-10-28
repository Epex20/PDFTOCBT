import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCbtSettings } from "@/hooks/useCbtSettings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const UserProfileDropdown = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { miscSettings } = useCbtSettings();

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    // First check if there's a username in settings
    if (miscSettings.username) {
      const nameParts = miscSettings.username.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return miscSettings.username.substring(0, 2).toUpperCase();
    }
    
    const email = user.email || '';
    const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
    
    if (name) {
      const nameParts = name.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    
    return email.substring(0, 2).toUpperCase();
  };

  // Get display name - prioritize settings username
  const getDisplayName = () => {
    if (miscSettings.username) {
      return miscSettings.username;
    }
    return user.user_metadata?.full_name || 
           user.user_metadata?.name || 
           user.email?.split('@')[0] || 
           'User';
  };

  // Get avatar URL - prioritize settings profile image
  const getAvatarUrl = () => {
    if (miscSettings.profileImg) {
      return miscSettings.profileImg;
    }
    return user.user_metadata?.avatar_url || 
           user.user_metadata?.picture || 
           '';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 gap-2 px-2 hover:bg-accent"
        >
          <Avatar className="h-8 w-8" style={{
            width: miscSettings.profileImg ? `${Math.min(miscSettings.imgWidth / 3, 32)}px` : '32px',
            height: miscSettings.profileImg ? `${Math.min(miscSettings.imgHeight / 3, 32)}px` : '32px',
          }}>
            <AvatarImage src={getAvatarUrl()} alt={getDisplayName()} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left max-w-[150px] hidden sm:flex">
            <span className="text-sm font-medium truncate w-full">
              {getDisplayName()}
            </span>
            <span className="text-xs text-muted-foreground truncate w-full">
              {user.email}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => navigate('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
