import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Mail, ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

const EmailConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  useEffect(() => {
    // If no email parameter, redirect to auth
    if (!email) {
      navigate('/auth');
    }
  }, [email, navigate]);

  return (
    <div className="min-h-screen bg-[var(--gradient-hero)]">
      <AppHeader showLogout={false} />
      
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
                  <Mail className="w-12 h-12 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
                Check Your Email
              </CardTitle>
              <CardDescription className="text-base">
                We've sent a confirmation email to verify your account
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Confirmation email sent
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {email ? `Check your inbox at ${email}` : 'Check your email inbox'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="space-y-2">
                  <p className="font-medium">Next steps:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open your email inbox</li>
                    <li>Find the confirmation email from PDFtoCBT</li>
                    <li>Click the "Confirm Email" button</li>
                    <li>You'll be redirected back to login</li>
                  </ol>
                </div>
                
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium mb-1">Didn't receive the email?</p>
                  <ul className="space-y-1">
                    <li>• Check your spam/junk folder</li>
                    <li>• Make sure you entered the correct email</li>
                    <li>• The email may take a few minutes to arrive</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => navigate('/auth')}
                  className="w-full"
                  variant="default"
                >
                  Back to Login
                </Button>
                
                <Button 
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go to Homepage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmailConfirmation;