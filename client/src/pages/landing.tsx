import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun, Shield, TrendingUp, Users, Mic, LogIn, Mail, Lock } from "lucide-react";

export default function Landing() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Mic className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-card-foreground">VoiceAI Dashboard</span>
            </div>
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="button-theme-toggle"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Login Section */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="p-8 bg-card/95 backdrop-blur-sm border-border shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Mic className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-3xl font-bold text-card-foreground mb-2">Welcome Back</h2>
              <p className="text-muted-foreground">Sign in to access your VoiceAI Dashboard</p>
            </div>

            <form 
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = "/api/login";
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10 h-11"
                    data-testid="input-email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    className="pl-10 h-11"
                    data-testid="input-password"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-11" 
                size="lg" 
                data-testid="button-login"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign In
              </Button>

              <p className="text-xs text-center text-muted-foreground pt-2">
                Admin users (cc@siwaht.com) will be automatically granted admin privileges upon login.
              </p>
            </form>
          </Card>

          {/* Info Section */}
          <div className="mt-8 text-center">
            <h3 className="text-lg font-semibold text-card-foreground mb-4">
              What is VoiceAI Dashboard?
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto" data-testid="text-info-description">
              A comprehensive monitoring platform for ElevenLabs voice agents with enterprise-grade security, 
              real-time analytics, and multi-tenant support.
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Secure BYOK</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Real-time Analytics</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Multi-tenant</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}