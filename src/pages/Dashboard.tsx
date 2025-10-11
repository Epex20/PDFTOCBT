import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { LogOut, GraduationCap, FileText, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchTests(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        fetchTests(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchTests = async (userId: string) => {
    const { data, error } = await supabase
      .from("tests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching tests",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTests(data || []);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleFileSelect = async (file: File) => {
    if (!user) return;

    // Here you would integrate your PDF to CBT conversion code
    // For now, we'll create a test entry
    const { data, error } = await supabase
      .from("tests")
      .insert({
        user_id: user.id,
        title: file.name.replace(".pdf", ""),
        pdf_name: file.name,
        status: "ready",
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error creating test",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Test created successfully!",
        description: "Your PDF has been processed.",
      });
      // Add sample questions for demo
      await addSampleQuestions(data.id);
      fetchTests(user.id);
    }
  };

  const addSampleQuestions = async (testId: string) => {
    const sampleQuestions = [
      {
        test_id: testId,
        question_number: 1,
        question_text: "What is the capital of France?",
        option_a: "London",
        option_b: "Paris",
        option_c: "Berlin",
        option_d: "Madrid",
        correct_answer: "B",
      },
      {
        test_id: testId,
        question_number: 2,
        question_text: "Which planet is known as the Red Planet?",
        option_a: "Venus",
        option_b: "Jupiter",
        option_c: "Mars",
        option_d: "Saturn",
        correct_answer: "C",
      },
      {
        test_id: testId,
        question_number: 3,
        question_text: "What is 2 + 2?",
        option_a: "3",
        option_b: "4",
        option_c: "5",
        option_d: "6",
        correct_answer: "B",
      },
    ];

    await supabase.from("questions").insert(sampleQuestions);
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TestCraft
            </span>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">
            Upload a PDF with MCQ questions to create your test
          </p>
        </div>

        <FileUpload onFileSelect={handleFileSelect} />

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Your Tests</h2>
          {tests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No tests yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload your first PDF to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tests.map((test) => (
                <Card
                  key={test.id}
                  className="hover:shadow-[var(--shadow-glow)] transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/test/${test.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      {test.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date(test.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">Start Test</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
