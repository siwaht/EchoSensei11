import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Shield, TrendingUp, Users, Mic } from "lucide-react";

export default function Landing() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-card-foreground">VoiceAI Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="button-theme-toggle"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-features">
                Features
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-pricing">
                Pricing
              </Button>
              <Button asChild data-testid="button-get-started">
                <a href="/api/auth/login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-card-foreground mb-6">
            Monitor Your <span className="text-primary">VoiceAI</span> Agents
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-description">
            Enterprise-grade monitoring and analytics for ElevenLabs voice agents. Secure BYOK integration, 
            real-time insights, and comprehensive call tracking for your organization.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild data-testid="button-start-monitoring">
              <a href="/api/auth/login">Start Monitoring</a>
            </Button>
            <Button variant="outline" size="lg" data-testid="button-view-demo">
              View Demo
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <Card className="p-8 border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-4" data-testid="text-feature-title-security">Secure BYOK Integration</h3>
            <p className="text-gray-600 dark:text-gray-300" data-testid="text-feature-description-security">
              Bring your own ElevenLabs API key. We securely store and manage your credentials with enterprise-grade encryption.
            </p>
          </Card>

          <Card className="p-8 border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mb-6">
              <TrendingUp className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-4" data-testid="text-feature-title-analytics">Real-time Analytics</h3>
            <p className="text-gray-600 dark:text-gray-300" data-testid="text-feature-description-analytics">
              Comprehensive insights into your voice agent performance with detailed metrics and visualizations.
            </p>
          </Card>

          <Card className="p-8 border border-gray-200 dark:border-gray-700">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-4" data-testid="text-feature-title-multitenant">Multi-tenant Ready</h3>
            <p className="text-gray-600 dark:text-gray-300" data-testid="text-feature-description-multitenant">
              Strict data isolation ensures your organization's data remains secure and separate from others.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
