import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/QuestionCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trophy, CheckCircle, XCircle } from "lucide-react";

const Review = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviewData();
  }, [testId]);

  const fetchReviewData = async () => {
    if (!testId) return;

    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) return;

    // Fetch questions
    const { data: questionsData } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("question_number");

    // Fetch user answers
    const { data: answersData } = await supabase
      .from("user_answers")
      .select("*")
      .eq("test_id", testId)
      .eq("user_id", session.data.session.user.id);

    setQuestions(questionsData || []);
    setAnswers(answersData || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading review...</div>
      </div>
    );
  }

  const correctAnswers = answers.filter((a) => a.is_correct).length;
  const totalQuestions = questions.length;
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <header className="bg-card/50 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="shadow-[var(--shadow-glow)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Trophy className="w-8 h-8 text-primary" />
                Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {percentage}%
                  </div>
                  <div className="text-sm text-muted-foreground">Score</div>
                </div>
                <div className="text-center p-6 rounded-lg bg-gradient-to-br from-success/10 to-success/5">
                  <div className="text-4xl font-bold text-success mb-2 flex items-center justify-center gap-2">
                    <CheckCircle className="w-8 h-8" />
                    {correctAnswers}
                  </div>
                  <div className="text-sm text-muted-foreground">Correct</div>
                </div>
                <div className="text-center p-6 rounded-lg bg-gradient-to-br from-destructive/10 to-destructive/5">
                  <div className="text-4xl font-bold text-destructive mb-2 flex items-center justify-center gap-2">
                    <XCircle className="w-8 h-8" />
                    {totalQuestions - correctAnswers}
                  </div>
                  <div className="text-sm text-muted-foreground">Incorrect</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold">All Questions</h2>
            {questions.map((question) => {
              const userAnswer = answers.find(
                (a) => a.question_id === question.id
              );
              return (
                <QuestionCard
                  key={question.id}
                  questionNumber={question.question_number}
                  questionText={question.question_text}
                  options={{
                    a: question.option_a,
                    b: question.option_b,
                    c: question.option_c,
                    d: question.option_d,
                  }}
                  selectedAnswer={userAnswer?.selected_answer}
                  onAnswerSelect={() => {}}
                  showCorrect={true}
                  correctAnswer={question.correct_answer}
                />
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button size="lg" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Review;
