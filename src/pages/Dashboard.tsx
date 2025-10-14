import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { LogOut, GraduationCap, FileText, Clock, Scissors } from "lucide-react";
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

    // Test creation disabled - file upload only
    toast({
      title: "File uploaded",
      description: "File selected successfully. Use PDF Cropper for question creation.",
    });

    // TODO: Add your PDF processing logic here when ready
    // const { data, error } = await supabase
    //   .from("tests")
    //   .insert({
    //     user_id: user.id,
    //     title: file.name.replace(".pdf", ""),
    //     pdf_name: file.name,
    //     status: "ready",
    //   })
    //   .select()
    //   .single();

    // if (error) {
    //   toast({
    //     title: "Error creating test",
    //     description: error.message,
    //     variant: "destructive",
    //   });
    // } else {
    //   toast({
    //     title: "Test created successfully!",
    //     description: "Your PDF has been processed.",
    //   });
    //   fetchTests(user.id);
    // }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              PDFtoCBT
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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quick Upload
              </CardTitle>
              <CardDescription>
                Upload PDF and auto-generate test questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload onFileSelect={handleFileSelect} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                PDF Cropper
              </CardTitle>
              <CardDescription>
                Manually crop questions from PDF for precise control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/pdf-cropper')} 
                className="w-full"
                variant="outline"
              >
                Open PDF Cropper
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Tests</h2>
            {tests.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={async () => {
                  if (confirm("Are you sure you want to delete all tests? This cannot be undone.")) {
                    // First delete all questions for all tests by this user
                    for (const test of tests) {
                      await supabase.from("questions").delete().eq("test_id", test.id);
                    }
                    // Then delete all tests by this user
                    await supabase.from("tests").delete().eq("user_id", user.id);
                    fetchTests(user.id);
                    toast({ title: "All tests deleted" });
                  }
                }}
              >
                Clear All Tests
              </Button>
            )}
          </div>
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
