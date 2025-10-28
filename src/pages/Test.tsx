import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/QuestionCard";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useCbtSettings } from "@/hooks/useCbtSettings";

const Test = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0])); // Track visited questions
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { uiSettings } = useCbtSettings();

  // Font size mapping
  const fontSizeMap = {
    'small': 'text-sm',
    'medium': 'text-base',
    'large': 'text-lg',
    'extra-large': 'text-xl'
  };

  useEffect(() => {
    // Check if questions are passed via router state (from ZIP import)
    const state = location.state as { questions?: any[]; testTitle?: string; fromZipImport?: boolean } | null;
    if (state?.fromZipImport && state.questions) {
      setQuestions(state.questions);
      setLoading(false);
      toast({
        title: "Test loaded from ZIP",
        description: `${state.questions.length} questions ready`,
      });
    } else {
      fetchQuestions();
    }
  }, [testId, location.state]);

  const fetchQuestions = async () => {
    if (!testId) return;

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("question_number");

    if (error) {
      toast({
        title: "Error loading test",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } else {
      // Parse image data from JSON if it exists
      const processedQuestions = (data || []).map(question => {
        try {
          const questionData = JSON.parse(question.question_text);
          if (questionData.type === 'image' && questionData.imageData) {
            return {
              ...question,
              imageData: questionData.imageData,
              isImageBased: true
            };
          }
        } catch (e) {
          // If JSON parsing fails, treat as regular text question
        }
        return {
          ...question,
          isImageBased: false
        };
      });
      
      setQuestions(processedQuestions);
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const navigateToQuestion = (questionIndex: number) => {
    setCurrentQuestion(questionIndex);
    setVisitedQuestions(prev => new Set([...prev, questionIndex]));
  };

  const handleSubmit = async () => {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) return;

    const userAnswers = questions.map((q) => ({
      user_id: session.data.session.user.id,
      test_id: testId,
      question_id: q.id,
      selected_answer: answers[q.id] || "",
      is_correct: answers[q.id] === q.correct_answer,
    }));

    const { error } = await supabase.from("user_answers").upsert(userAnswers);

    if (error) {
      toast({
        title: "Error submitting test",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Test submitted!",
        description: "View your results on the review page.",
      });
      navigate(`/review/${testId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading test...</div>
      </div>
    );
  }

  const progress = (Object.keys(answers).length / questions.length) * 100;
  const question = questions[currentQuestion];

  return (
    <div className={`min-h-screen bg-[var(--gradient-hero)] ${fontSizeMap[uiSettings.fontSize]}`}>
      <AppHeader showLogout={true} />
      
      <header className="bg-card/50 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Test in Progress</h1>
              <span className="text-sm text-muted-foreground">
                {Object.keys(answers).length} of {questions.length} answered
              </span>
            </div>
            {uiSettings.showProgressBar && (
              <Progress value={progress} className="h-2" />
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Left Side - Question Display */}
          <div className="lg:col-span-3 space-y-6">
            <QuestionCard
              questionNumber={question.question_number}
              questionText={question.question_text}
              options={{
                a: question.option_a,
                b: question.option_b,
                c: question.option_c,
                d: question.option_d,
              }}
              selectedAnswer={answers[question.id]}
              onAnswerSelect={(answer) => handleAnswerSelect(question.id, answer)}
              imageData={question.imageData}
            />

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => navigateToQuestion(Math.max(0, currentQuestion - 1))}
                disabled={currentQuestion === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentQuestion === questions.length - 1 ? (
                <Button onClick={handleSubmit}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Test
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    navigateToQuestion(Math.min(questions.length - 1, currentQuestion + 1))
                  }
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Right Side - Question Navigation Panel */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-lg border p-4 sticky top-24">
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-3">Question Palette</h3>
                </div>

                {/* Legend */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-200 text-gray-600 rounded flex items-center justify-center font-medium text-xs border">
                      49
                    </div>
                    <span className="text-gray-600">Not Visited</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-500 text-white rounded flex items-center justify-center font-medium text-xs">
                      1
                    </div>
                    <span className="text-gray-600">Not Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-green-500 text-white rounded flex items-center justify-center font-medium text-xs">
                      0
                    </div>
                    <span className="text-gray-600">Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-500 text-white rounded flex items-center justify-center font-medium text-xs">
                      0
                    </div>
                    <span className="text-gray-600">Marked for Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-700 text-white rounded flex items-center justify-center font-medium text-xs">
                      0
                    </div>
                    <span className="text-gray-600 text-xs">Answered & Marked for Review</span>
                  </div>
                </div>

                {/* Question Grid */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-8 gap-1 max-h-96 overflow-y-auto">
                    {questions.map((q, idx) => {
                      const isAnswered = !!answers[q.id];
                      const isCurrent = currentQuestion === idx;
                      const isVisited = visitedQuestions.has(idx);
                      
                      // Determine button style based on state
                      let buttonClass = "w-8 h-8 text-xs font-medium rounded transition-all flex items-center justify-center border ";
                      
                      if (isCurrent) {
                        // Current question - highlighted border
                        if (isAnswered) {
                          buttonClass += "bg-green-500 text-white border-2 border-blue-400 shadow-lg";
                        } else if (isVisited) {
                          buttonClass += "bg-red-500 text-white border-2 border-blue-400 shadow-lg";
                        } else {
                          buttonClass += "bg-gray-200 text-gray-600 border-2 border-blue-400 shadow-lg";
                        }
                      } else if (isAnswered) {
                        // Answered (green)
                        buttonClass += "bg-green-500 text-white border-green-600 hover:bg-green-600";
                      } else if (isVisited) {
                        // Visited but not answered (red)
                        buttonClass += "bg-red-500 text-white border-red-600 hover:bg-red-600";
                      } else {
                        // Not visited (gray)
                        buttonClass += "bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300";
                      }
                      
                      return (
                        <button
                          key={q.id}
                          className={buttonClass}
                          onClick={() => navigateToQuestion(idx)}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress Summary */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {Object.keys(answers).length}
                      </div>
                      <div className="text-xs text-gray-600">Answered</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {questions.length - Object.keys(answers).length}
                      </div>
                      <div className="text-xs text-gray-600">Not Answered</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t pt-4 space-y-2">
                  <button
                    className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    onClick={() => {
                      const nextUnanswered = questions.findIndex((q, idx) => !answers[q.id] && idx > currentQuestion);
                      if (nextUnanswered !== -1) {
                        navigateToQuestion(nextUnanswered);
                      }
                    }}
                    disabled={Object.keys(answers).length === questions.length}
                  >
                    Next
                  </button>
                  
                  {Object.keys(answers).length === questions.length && (
                    <button
                      onClick={handleSubmit}
                      className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Submit Test
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Test;
