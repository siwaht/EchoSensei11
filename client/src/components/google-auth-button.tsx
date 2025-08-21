import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Chrome, LogOut, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GoogleAuthButtonProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: string) => void;
}

export function GoogleAuthButton({ onAuthSuccess, onAuthError }: GoogleAuthButtonProps) {
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Check Google auth status
  const { data: authStatus, isLoading } = useQuery<{
    connected: boolean;
    email: string | null;
    configured?: boolean;
  }>({
    queryKey: ['/api/auth/google/status'],
    refetchInterval: 5000, // Refetch every 5 seconds to check for auth completion
  });
  
  // Handle Google authentication
  const connectGoogle = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/google', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to initiate Google authentication');
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Google OAuth
      window.location.href = data.authUrl;
      setIsAuthenticating(true);
    },
    onError: (error: any) => {
      toast({
        title: 'Authentication Failed',
        description: error.message || 'Failed to connect with Google',
        variant: 'destructive',
      });
      onAuthError?.(error.message);
      setIsAuthenticating(false);
    },
  });
  
  // Handle disconnect
  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to disconnect Google account');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/google/status'] });
      toast({
        title: 'Google Account Disconnected',
        description: 'Your Google account has been disconnected successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Disconnect Failed',
        description: error.message || 'Failed to disconnect Google account',
        variant: 'destructive',
      });
    },
  });
  
  // Check for OAuth callback parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authResult = params.get('google_auth');
    
    if (authResult === 'success') {
      toast({
        title: 'Google Connected',
        description: 'Your Google account has been connected successfully',
      });
      onAuthSuccess?.();
      // Remove query params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticating(false);
    } else if (authResult === 'error') {
      toast({
        title: 'Authentication Failed',
        description: 'Failed to connect with Google. Please try again.',
        variant: 'destructive',
      });
      onAuthError?.('Authentication failed');
      // Remove query params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticating(false);
    }
  }, []);
  
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Checking Google connection...</span>
        </div>
      </Card>
    );
  }
  
  // Check if OAuth is not configured (server-side)
  if (authStatus && authStatus.configured === false) {
    return (
      <Card className="p-4 border-amber-200 bg-amber-50">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Chrome className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">Google OAuth Not Configured</p>
              <p className="text-xs text-amber-700">
                Google OAuth credentials need to be set up by the administrator
              </p>
            </div>
          </div>
          <div className="text-xs text-amber-700 space-y-1">
            <p>Once configured, you'll be able to:</p>
            <ul className="list-disc list-inside pl-2">
              <li>Send and read emails via Gmail</li>
              <li>Read and write to Google Sheets</li>
              <li>Create and manage Calendar events</li>
            </ul>
          </div>
        </div>
      </Card>
    );
  }
  
  if (authStatus?.connected) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Chrome className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Google Account Connected</p>
                <p className="text-xs text-muted-foreground">{authStatus.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnectGoogle.mutate()}
              disabled={disconnectGoogle.isPending}
            >
              {disconnectGoogle.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Access granted to Gmail, Sheets, and Calendar
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-1">Connect Google Account</p>
          <p className="text-xs text-muted-foreground">
            Sign in with Google to enable Gmail, Sheets, and Calendar integrations
          </p>
        </div>
        <Button
          onClick={() => connectGoogle.mutate()}
          disabled={connectGoogle.isPending || isAuthenticating}
          className="w-full"
        >
          {connectGoogle.isPending || isAuthenticating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Chrome className="w-5 h-5 mr-2" />
              Sign in with Google
            </>
          )}
        </Button>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>This will grant access to:</p>
          <ul className="list-disc list-inside pl-2">
            <li>Send and read emails via Gmail</li>
            <li>Read and write to Google Sheets</li>
            <li>Create and manage Calendar events</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}