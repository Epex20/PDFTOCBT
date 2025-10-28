import { AppHeader } from '@/components/AppHeader';
import { CbtSettings } from '@/components/CbtSettings';

const Settings = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <AppHeader showLogout={true} />
      
      <main className="container mx-auto py-8">
        <CbtSettings />
      </main>
    </div>
  );
};

export default Settings;
