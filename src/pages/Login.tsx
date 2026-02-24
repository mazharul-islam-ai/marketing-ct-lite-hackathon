import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-sji-login.png";

// Demo credentials (for development/demo purposes)
const DEMO_CREDENTIALS = {
  admin: {
    email: "demo.admin@sjinnovation.com",
    password: "demo-password-123",
    label: "Admin Demo",
  },
  user: {
    email: "demo.user@sjinnovation.com",
    password: "demo-password-123",
    label: "User Demo",
  },
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [error, setError] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const from = location.state?.from?.pathname || "/dashboard";

  // If user is already logged in, redirect them
  if (user && !loading) {
    console.log("[Login] User logged in, redirecting to:", from);
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      console.log("[Login] Attempting login with:", email);
      await login({ email, password });
      console.log("[Login] Login successful, user context should update...");

      // Wait for auth state to update with user profile
      // The useAuth hook's onAuthStateChange listener will set the user
      // This timeout allows time for the listener to fetch the profile
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (err) {
      console.error("[Login] Login error:", err);
      setError((err as Error).message || "Login failed");
    }
  };

  const fillDemoCredentials = (credentials: { email: string; password: string }) => {
    setEmail(credentials.email);
    setPassword(credentials.password);
    setError("");
    // Trigger form submission after state updates
    setTimeout(() => {
      formRef.current?.dispatchEvent(new Event("submit", { bubbles: true }));
    }, 0);
  };

  const handleMagicLinkLogin = async () => {
    if (!magicLinkEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (!magicLinkEmail.toLowerCase().endsWith('@sjinnovation.com')) {
      toast({
        title: "Error",
        description: "Only @sjinnovation.com email addresses are allowed",
        variant: "destructive",
      });
      return;
    }

    setMagicLinkLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast({
        title: "Magic Link Sent!",
        description: "Check your email for the login link. It will expire in 1 hour.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message || "Failed to send magic link",
        variant: "destructive",
      });
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    if (!resetEmail.toLowerCase().endsWith('@sjinnovation.com')) {
      toast({
        title: "Error",
        description: "Only @sjinnovation.com email addresses are allowed",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'https://marketing.sjinnovation.us/reset-password',
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password reset email sent! Check your inbox.",
      });
      setIsResetDialogOpen(false);
      setResetEmail("");
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center justify-center mb-4">
            <img src={logo} alt="SJ Innovation" className="h-20 w-auto mb-3" />
            <p className="text-white/90 text-sm">Intelligence Dashboard + AI Task Hub</p>
          </div>
        </div>

        <Card className="backdrop-blur-sm bg-white/95 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">
              Choose your sign-in method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="password" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </TabsTrigger>
                <TabsTrigger value="magiclink" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Magic Link
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password">
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                    />
                  </div>

                  {/* Demo Credentials Section */}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 my-4">
                    <p className="text-sm font-medium text-amber-900 mb-3">
                      Demo Credentials
                    </p>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => fillDemoCredentials(DEMO_CREDENTIALS.admin)}
                        disabled={loading}
                      >
                        <Mail className="mr-2 h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">
                            {DEMO_CREDENTIALS.admin.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {DEMO_CREDENTIALS.admin.email}
                          </div>
                        </div>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        onClick={() => fillDemoCredentials(DEMO_CREDENTIALS.user)}
                        disabled={loading}
                      >
                        <Mail className="mr-2 h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium">
                            {DEMO_CREDENTIALS.user.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {DEMO_CREDENTIALS.user.email}
                          </div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-primary hover:shadow-glow" 
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>

                  <div className="text-center mt-2">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-primary"
                      onClick={() => setIsResetDialogOpen(true)}
                    >
                      Forgot Password?
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="magiclink">
                <div className="space-y-4">
                  {magicLinkSent ? (
                    <div className="text-center py-6">
                      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Mail className="h-8 w-8 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">Check Your Email</h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        We've sent a magic link to <strong>{magicLinkEmail}</strong>.
                        <br />Click the link in your email to sign in.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMagicLinkSent(false);
                          setMagicLinkEmail("");
                        }}
                      >
                        Use a different email
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground text-center">
                        Sign in without a password. We'll send a magic link to your email.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="magic-email">Email</Label>
                        <Input
                          id="magic-email"
                          type="email"
                          value={magicLinkEmail}
                          onChange={(e) => setMagicLinkEmail(e.target.value)}
                          placeholder="your.name@sjinnovation.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Only @sjinnovation.com emails are supported
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="w-full bg-gradient-primary hover:shadow-glow"
                        onClick={handleMagicLinkLogin}
                        disabled={magicLinkLoading}
                      >
                        {magicLinkLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Magic Link
                      </Button>
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Password Reset Dialog */}
        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your.email@sjinnovation.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Only @sjinnovation.com email addresses are supported
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsResetDialogOpen(false)}
                  disabled={resetLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handlePasswordReset} disabled={resetLoading}>
                  {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}