import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface QuestionCardProps {
  questionNumber: number;
  questionText: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  selectedAnswer?: string;
  onAnswerSelect: (answer: string) => void;
  showCorrect?: boolean;
  correctAnswer?: string;
}

export const QuestionCard = ({
  questionNumber,
  questionText,
  options,
  selectedAnswer,
  onAnswerSelect,
  showCorrect = false,
  correctAnswer,
}: QuestionCardProps) => {
  const getOptionStyle = (option: string) => {
    if (!showCorrect) return "";
    if (option === correctAnswer) return "border-success bg-success/10";
    if (option === selectedAnswer && option !== correctAnswer)
      return "border-destructive bg-destructive/10";
    return "";
  };

  return (
    <Card className="shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-glow)] transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-start gap-3">
          <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground text-sm font-bold">
            {questionNumber}
          </span>
          <span className="text-lg">{questionText}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedAnswer}
          onValueChange={onAnswerSelect}
          disabled={showCorrect}
          className="space-y-3"
        >
          {Object.entries(options).map(([key, value]) => (
            <div
              key={key}
              className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${getOptionStyle(
                key.toUpperCase()
              )} ${
                selectedAnswer === key.toUpperCase()
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <RadioGroupItem value={key.toUpperCase()} id={`q${questionNumber}-${key}`} />
              <Label
                htmlFor={`q${questionNumber}-${key}`}
                className="flex-1 cursor-pointer font-normal"
              >
                <span className="font-semibold mr-2">{key.toUpperCase()}.</span>
                {value}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};
