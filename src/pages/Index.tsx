import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, FileText, CheckCircle, BarChart } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <AppHeader showLogout={false} />

      <main className="container mx-auto px-4 py-16 space-y-20">
        <section className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-primary to-secondary shadow-[var(--shadow-glow)] animate-fade-in">
              <GraduationCap className="w-16 h-16 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Transform PDFs into{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Interactive Tests
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload your PDF with MCQ questions and create professional computer-based tests in seconds. 
            Perfect for educators, trainers, and students.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg">
              Start Creating Tests
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="text-lg">
              Sign In
            </Button>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10">
                <FileText className="w-8 h-8 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-bold">Upload PDF</h3>
            <p className="text-muted-foreground">
              Simply drag and drop your PDF file with MCQ questions or browse to select
            </p>
          </div>

          <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-secondary/10 to-accent/10">
                <CheckCircle className="w-8 h-8 text-secondary" />
              </div>
            </div>
            <h3 className="text-xl font-bold">Take Test</h3>
            <p className="text-muted-foreground">
              Experience a smooth, distraction-free testing interface with progress tracking
            </p>
          </div>

          <div className="text-center space-y-4 p-6 rounded-2xl bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-accent/10 to-primary/10">
                <BarChart className="w-8 h-8 text-accent" />
              </div>
            </div>
            <h3 className="text-xl font-bold">Review Results</h3>
            <p className="text-muted-foreground">
              Get instant feedback with detailed answers and performance metrics
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card/50 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 PDFtoCBT. Transform your assessments.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
