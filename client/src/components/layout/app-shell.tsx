import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { 
  Home, 
  Bot, 
  BookOpen,
  Wrench,
  AudioWaveform,
  MessageSquare,
  Plug, 
  Phone,
  PhoneOutgoing,
  Settings, 
  Menu, 
  Moon, 
  Sun,
  LogOut,
  Shield,
  ChevronDown,
  Bell,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
// Removed Collapsible imports - no longer needed

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  // Removed expandedSections since we no longer have collapsible sections

  const navigation: NavItem[] = [
    { name: "Home", href: "/", icon: Home },
    { name: "Agents", href: "/agents", icon: Bot },
    { name: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
    { name: "Tools", href: "/tools", icon: Wrench },
    { name: "Voices", href: "/voices", icon: AudioWaveform },
    { name: "Conversations", href: "/conversations", icon: MessageSquare },
    { name: "Phone Numbers", href: "/phone-numbers", icon: Phone },
    { name: "Outbound", href: "/outbound", icon: PhoneOutgoing },
    { name: "Integrations", href: "/integrations", icon: Plug },
  ];

  // Removed toggleSection function

  const getPageTitle = () => {
    // Check direct matches
    const directMatch = navigation.find(item => item.href === location);
    if (directMatch) return directMatch.name;
    
    // Special cases
    if (location.startsWith('/agents/')) return 'Agent Settings';
    if (location === '/playground') return 'Playground';
    if (location === '/settings') return 'Settings';
    if (location === '/admin') return 'Admin';
    if (location === '/billing') return 'Billing';
    if (location === '/checkout') return 'Checkout';
    if (location === '/history') return 'Conversations'; // Redirect old history to conversations
    
    return 'Home';
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
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 border-r transform transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-14 px-4 border-b flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <AudioWaveform className="w-5 h-5 text-white dark:text-black" />
            </div>
            <div className="text-xl font-bold">VoiceAI</div>
          </div>
        </div>
        
        <div className="px-3 py-2">
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-2.5 flex items-center gap-2">
            <div className="flex -space-x-1">
              <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white dark:border-gray-950" />
              <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-950" />
            </div>
            <span className="text-sm font-medium flex-1">Conversational AI</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <nav className="mt-2 px-3 pb-8">
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-gray-100 dark:bg-gray-900 text-black dark:text-white"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

        </nav>
        
        {/* Footer section */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t">
          <div className="space-y-0.5">
            <Link
              href="/notifications"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                location === "/notifications"
                  ? "bg-gray-100 dark:bg-gray-900 text-black dark:text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              )}
              data-testid="nav-notifications"
            >
              <Bell className="w-4 h-4 flex-shrink-0" />
              <span>Notifications</span>
            </Link>
            <Link
              href="/billing"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                location === "/billing"
                  ? "bg-gray-100 dark:bg-gray-900 text-black dark:text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              )}
              data-testid="nav-billing"
            >
              <CreditCard className="w-4 h-4 flex-shrink-0" />
              <span>Billing</span>
            </Link>
            {user?.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  location === "/admin"
                    ? "bg-gray-100 dark:bg-gray-900 text-black dark:text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                )}
                data-testid="nav-admin"
              >
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>Admin</span>
              </Link>
            )}
            <Link
              href="/settings"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                location === "/settings"
                  ? "bg-gray-100 dark:bg-gray-900 text-black dark:text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              )}
              data-testid="nav-settings"
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="bg-white dark:bg-gray-950 border-b px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
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
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium" data-testid="text-user-initials">
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
        <main className="p-4 sm:p-6 lg:p-8">
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
