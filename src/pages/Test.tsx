import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/QuestionCard";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react";

const Test = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [testId]);

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
      setQuestions(data || []);
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
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
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <header className="bg-card/50 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Test in Progress</h1>
              <span className="text-sm text-muted-foreground">
                {Object.keys(answers).length} of {questions.length} answered
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
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
          />

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
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
                  setCurrentQuestion((prev) => Math.min(questions.length - 1, prev + 1))
                }
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-center pt-4">
            {questions.map((q, idx) => (
              <Button
                key={q.id}
                variant={currentQuestion === idx ? "default" : "outline"}
                size="sm"
                className={`w-10 h-10 ${
                  answers[q.id] ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                onClick={() => setCurrentQuestion(idx)}
              >
                {idx + 1}
              </Button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Test;
