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
  imageData?: string; // Base64 image data for image-based questions
}

export const QuestionCard = ({
  questionNumber,
  questionText,
  options,
  selectedAnswer,
  onAnswerSelect,
  showCorrect = false,
  correctAnswer,
  imageData,
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
          <div className="flex-1">
            {imageData ? (
              <div className="space-y-3">
                <div className="text-lg">Question {questionNumber}</div>
                <div className="border rounded-lg overflow-hidden bg-white">
                  {(() => {
                    try {
                      // Try to parse JSON for image info
                      const imageInfo = JSON.parse(imageData)
                      if (imageInfo.type === 'image') {
                        // Use storage URL if available, otherwise fallback to base64
                        const imageSrc = imageInfo.imageUrl || imageInfo.imageData
                        return (
                          <div>
                            <img 
                              src={imageSrc} 
                              alt={`Question ${questionNumber}`}
                              className="w-full max-w-2xl h-auto object-contain"
                            />
                            {/* Optional: Show storage method for debugging */}
                            {process.env.NODE_ENV === 'development' && imageInfo.storageMethod && (
                              <div className="text-xs text-gray-500 p-2">
                                Storage: {imageInfo.storageMethod}
                              </div>
                            )}
                          </div>
                        )
                      }
                    } catch (e) {
                      // If not JSON, treat as direct base64 data
                      console.log('Using direct base64 data for question', questionNumber)
                    }
                    
                    // Fallback to direct image data
                    return (
                      <img 
                        src={imageData} 
                        alt={`Question ${questionNumber}`}
                        className="w-full max-w-2xl h-auto object-contain"
                      />
                    )
                  })()}
                </div>
              </div>
            ) : (
              <span className="text-lg">{questionText}</span>
            )}
          </div>
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
