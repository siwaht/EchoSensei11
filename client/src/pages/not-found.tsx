import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  
  return (
    <div>
      <div className="max-w-2xl mx-auto">
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-6 w-6" />
              404 - Page Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist. This might happen if:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>The URL was typed incorrectly</li>
              <li>The page has been moved or deleted</li>
              <li>You don't have permission to access this page</li>
            </ul>
            
            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button 
                onClick={() => window.history.back()}
                variant="outline"
                className="gap-2"
                data-testid="button-go-back"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button 
                onClick={() => setLocation("/")}
                className="gap-2"
                data-testid="button-go-home"
              >
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
