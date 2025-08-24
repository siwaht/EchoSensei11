import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { 
  Mic, 
  LayoutDashboard, 
  Bot, 
  History,
  Plug, 
  CreditCard, 
  Settings, 
  Menu, 
  Moon, 
  Sun,
  LogOut,
  Shield,
  FlaskConical,
  Phone,
  PhoneOutgoing,
  Wrench,
  MessageSquare,
  Brain,
  AppWindow
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Voices", href: "/voices", icon: Mic },
  { name: "Phone Numbers", href: "/phone-numbers", icon: Phone },
  { name: "Outbound Calling", href: "/outbound-calling", icon: PhoneOutgoing },
  { name: "Tools", href: "/tools", icon: Wrench },
  { name: "Conversations", href: "/conversations", icon: MessageSquare },
  { name: "Knowledge Base", href: "/knowledge-base", icon: Brain },
  { name: "Widget", href: "/widget", icon: AppWindow },
  { name: "Playground", href: "/playground", icon: FlaskConical },
  { name: "Call History", href: "/history", icon: History },
  { name: "Integrations", href: "/integrations", icon: Plug },
  { name: "Billing", href: "/billing", icon: CreditCard },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const getPageTitle = () => {
    const currentNav = navigation.find(item => item.href === location);
    if (currentNav) return currentNav.name;
    
    // Check for admin route
    if (location === "/admin") return "Admin";
    
    // Check for settings route
    if (location === "/settings") return "Settings";
    
    // Check for checkout route
    if (location === "/checkout") return "Checkout";
    
    // Check for voices route
    if (location === "/voices") return "Voices";
    
    // Check for phone numbers route
    if (location === "/phone-numbers") return "Phone Numbers";
    
    // Check for outbound calling route
    if (location === "/outbound-calling") return "Outbound Calling";
    
    // Check for tools route
    if (location === "/tools") return "Tools";
    
    // Check for conversations route
    if (location === "/conversations") return "Conversations";
    
    // Check for knowledge base route
    if (location === "/knowledge-base") return "Knowledge Base";
    
    // Check for widget route
    if (location === "/widget") return "Widget Configuration";
    
    // Check for agent settings route
    if (location.startsWith("/agents/") && location.includes("/settings")) return "Agent Settings";
    
    // Default to "Page Not Found" for unknown routes
    return "Page Not Found";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-card/95 backdrop-blur border-r border-border transform transition-transform duration-200 ease-in-out shadow-xl flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-16 px-4 lg:px-6 border-b border-border flex-shrink-0">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="w-8 h-8 gradient-purple rounded-lg flex items-center justify-center shadow-lg">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="text-base lg:text-lg font-bold gradient-text truncate" data-testid="text-app-title">VoiceAI</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto mt-6 px-3 pb-6">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    isActive
                      ? "gradient-purple text-white shadow-lg"
                      : "text-muted-foreground hover:text-card-foreground hover:bg-muted/50 hover:shadow-md"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="space-y-1">
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    location === "/admin"
                      ? "gradient-purple text-white shadow-lg"
                      : "text-muted-foreground hover:text-card-foreground hover:bg-muted/50 hover:shadow-md"
                  )}
                  data-testid="nav-admin"
                >
                  <Shield className="w-5 h-5" />
                  <span>Admin</span>
                </Link>
              )}
              {secondaryNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-card-foreground hover:bg-muted/50 transition-colors"
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="ml-4 lg:ml-0 text-2xl font-semibold text-card-foreground" data-testid="text-page-title">
              {getPageTitle()}
            </h1>
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
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 gradient-purple rounded-full flex items-center justify-center shadow-md ring-2 ring-primary/20">
                <span className="text-white text-sm font-medium" data-testid="text-user-initials">
                  {(user as any)?.firstName?.[0]}{(user as any)?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-card-foreground" data-testid="text-user-name">
                  {(user as any)?.firstName} {(user as any)?.lastName}
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-organization-name">
                  Organization
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                data-testid="button-logout"
              >
                <a href="/api/logout">
                  <LogOut className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 fade-in">
          {children}
        </main>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
