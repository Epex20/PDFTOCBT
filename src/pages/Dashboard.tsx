import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { useToast } from "@/hooks/use-toast";
import { LogOut, GraduationCap, FileText, Clock, Scissors, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AppHeader } from "@/components/AppHeader";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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

  const toggleTestSelection = (testId: string) => {
    setSelectedTests(prev => 
      prev.includes(testId) 
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTests.length === tests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(tests.map(test => test.id));
    }
  };

  const deleteSelectedTests = async () => {
    if (selectedTests.length === 0) return;

    const confirmMessage = selectedTests.length === 1 
      ? "Are you sure you want to delete this test? This cannot be undone."
      : `Are you sure you want to delete ${selectedTests.length} tests? This cannot be undone.`;

    if (confirm(confirmMessage)) {
      try {
        // First delete all questions for selected tests
        for (const testId of selectedTests) {
          await supabase.from("questions").delete().eq("test_id", testId);
        }
        
        // Then delete the selected tests
        const { error } = await supabase
          .from("tests")
          .delete()
          .in("id", selectedTests);

        if (error) throw error;

        // Refresh the tests list
        fetchTests(user.id);
        
        // Reset selection
        setSelectedTests([]);
        setIsSelectionMode(false);

        toast({ 
          title: "Tests deleted", 
          description: `${selectedTests.length} test(s) deleted successfully.`
        });
      } catch (error) {
        toast({
          title: "Error deleting tests",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!user) return;

    // Validate PDF file
    if (file.type !== "application/pdf") {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file only.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please select a PDF file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "PDF Selected",
      description: `${file.name} ready for cropping. Redirecting to PDF Cropper...`,
    });

    // Directly redirect to PDF Cropper with the file
    navigate('/pdf-cropper', { 
      state: { 
        pdfFile: file,
        fromDashboard: true 
      } 
    });
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <AppHeader showLogout={true} />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">
            Upload a PDF with MCQ questions to create your test
          </p>
        </div>

        <div className="space-y-6">
          {/* Main PDF Cropper Section - Priority */}
          <Card className="shadow-[var(--shadow-glow)] border-2 border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Scissors className="h-6 w-6 text-primary" />
                </div>
                PDF Cropper - Create Your Test
              </CardTitle>
              <CardDescription className="text-base">
                Upload a PDF and manually crop questions for precise control and accurate test creation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={() => navigate('/pdf-cropper')} 
                  className="flex-1 h-12 text-base font-medium"
                  size="lg"
                >
                  <Scissors className="h-5 w-5 mr-2" />
                  Start Creating Test
                </Button>
                <div className="flex-1 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  <div className="font-medium mb-1">Why use PDF Cropper?</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Precise question extraction</li>
                    <li>• Full control over question areas</li>
                    <li>• Support for complex layouts</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Upload - Compact Section */}
          <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Quick PDF Upload
                </CardTitle>
              </div>
              <CardDescription className="text-sm">
                Select a PDF file and we'll guide you to create questions
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <FileUpload onFileSelect={handleFileSelect} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Tests</h2>
            {tests.length > 0 && (
              <div className="flex gap-2">
                {!isSelectionMode ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsSelectionMode(true)}
                  >
                    Select Tests
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={toggleSelectAll}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {selectedTests.length === tests.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={deleteSelectedTests}
                      disabled={selectedTests.length === 0}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedTests.length})
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedTests([]);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
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
                  className={`hover:shadow-[var(--shadow-glow)] transition-all duration-300 relative ${
                    isSelectionMode ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    selectedTests.includes(test.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleTestSelection(test.id);
                    } else {
                      navigate(`/test/${test.id}`);
                    }
                  }}
                >
                  {isSelectionMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <Checkbox
                        checked={selectedTests.includes(test.id)}
                        onCheckedChange={() => toggleTestSelection(test.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <CardHeader className={isSelectionMode ? 'pl-10' : ''}>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      {test.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date(test.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={isSelectionMode ? 'pl-10' : ''}>
                    {!isSelectionMode && (
                      <Button className="w-full">Start Test</Button>
                    )}
                    {isSelectionMode && (
                      <div className="text-sm text-muted-foreground">
                        {selectedTests.includes(test.id) ? 'Selected for deletion' : 'Click to select'}
                      </div>
                    )}
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
