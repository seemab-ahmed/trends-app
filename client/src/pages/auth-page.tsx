import { useState } from "react";
import { buildApiUrl } from "@/lib/api-config";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";
import Authbg  from "../../public/images/auth-bg.png"
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  TrendingUp,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogle } from "@/lib/firebase-auth";

import { API_ENDPOINTS } from "@/lib/api-config";
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be less than 20 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    referralCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const newPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
type NewPasswordData = z.infer<typeof newPasswordSchema>;

export default function AuthPage() {
  const {
    user,
    loginMutation,
    registerMutation,
    verifyEmailMutation,
    requestPasswordResetMutation,
    resetPasswordMutation,
  } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [isResetRequested, setIsResetRequested] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google Sign-in handler
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      const result = await signInWithGoogle();

      // Get the ID token from Firebase
      const idToken = await result.user.getIdToken();

      // Send token to your backend
      const response = await fetch(buildApiUrl("/api/auth/google"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to authenticate with backend");
      }

      const data = await response.json();

      // Store the backend JWT in the standard key used by the app
      localStorage.setItem("authToken", data.token);
      window.location.reload(); // Simple refresh to update auth state

      toast({
        title: "Google login successful",
        description: `Welcome, ${
          result.user.displayName || result.user.email
        }!`,
      });
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast({
        title: "Google login failed",
        description: error.message || "An error occurred during Google sign-in",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Login form
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Register form
  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      referralCode: "",
    },
  });
  const [showReferral, setShowReferral] = useState(false);

  // Reset password form
  const resetPasswordForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // New password form
  const newPasswordForm = useForm<NewPasswordData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLoginSubmit = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterData) => {
    const { confirmPassword, referralCode, ...registerData } = data;
    const payload = referralCode
      ? { ...registerData, referralCode: referralCode.trim() }
      : registerData;
    // store pending code too in case flow redirects to login first
    if (referralCode)
      localStorage.setItem("pendingReferralCode", referralCode.trim());
    registerMutation.mutate(payload as any);
  };

  const onResetPasswordSubmit = (data: ResetPasswordData) => {
    requestPasswordResetMutation.mutate(data, {
      onSuccess: () => {
        setIsResetRequested(true);
        toast({
          title: "Reset email sent",
          description: "Check your email for password reset instructions.",
        });
      },
    });
  };

  const onNewPasswordSubmit = (data: NewPasswordData) => {
    const { confirmPassword, ...resetData } = data;
    resetPasswordMutation.mutate(resetData, {
      onSuccess: () => {
        setActiveTab("login");
        setIsResetRequested(false);
        setResetToken("");
        toast({
          title: "Password reset successful",
          description: "You can now log in with your new password.",
        });
      },
    });
  };

  // Check for reset token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");
  const verifyToken = urlParams.get("verify");

  if (verifyToken) {
    verifyEmailMutation.mutate({ token: verifyToken });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Verifying your email...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (token && !isResetRequested) {
    setResetToken(token);
    setActiveTab("new-password");
  }

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    // bg-gradient-to-l from-[#22263D] via-[#11131E] to-[#05070C] 
    <div className="min-h-screen flex flex-col lg:flex-row relative  ">
      <div className="absolute top-0 left-0 w-full h-full">
        <img src={Authbg} alt="Auth Background" className="w-full h-full object-cover" />
      </div>

      <div className="flex-1 relative z-[3] flex items-center justify-center py-12 md:px-8 px-5 lg:px-4">
        <Card className="w-full relative max-w-[500px] bg-white rounded-2xl border-0 lg:py-5 lg:px-8 p-5 pt-[50px] shadow-[0_0_10px_rgba(0,0,0,0.15)]">
          
          <div className=" flex items-center gap-2 absolute top-2 right-2 lg:hidden block">
          <img
            src="/images/trend-logo.png"
            alt="Trend Logo"
            className="h-10 w-10 object-contain"
          />
          <span className="text-black text-3xl font-semibold">Trend</span>
        </div>         
          <CardContent className="p-0">
            <div className="text-center mb-4">
              <h1 className="text-3xl font-bold text-black mb-4 text-left">
                {activeTab === "login"
                  ? "Sign in"
                  : activeTab === "register"
                  ? "Register"
                  : "Reset Password"}
              </h1>
              <p className="text-black/80 text-sm leading-relaxed text-left">
                Predict the market Build your reputation No broker, no risk.
                Just skill, just reputation
                {/* <br /> */}
              </p>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="flex space-x-1 mb-4 rounded-full overflow-x-scroll no-scrollbar p-2 bg-gray-300/50 justify-between">
                <button
                  onClick={() => setActiveTab("login")}
                  className={`px-6 py-2 rounded-full md:text-sm text-[12px] font-[600] transition-all min-w-[90px] ${
                    activeTab === "login"
                      ? "bg-blue-600 text-white"
                      : "text-black hover:text-black/80"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setActiveTab("register")}
                  className={`px-6 py-2 rounded-full md:text-sm text-[12px] font-[600] transition-all  min-w-[90px] ${
                    activeTab === "register"
                      ? "bg-blue-600 text-white"
                      : "text-black hover:text-black/80"
                  }`}
                >
                  Register
                </button>
                <button
                  onClick={() => setActiveTab("reset-password")}
                  className={`px-6 py-2 rounded-full md:text-sm text-[12px] font-[600] transition-all  min-w-[140px] ${
                    activeTab === "reset-password"
                      ? "bg-blue-600 text-white"
                      : "text-black hover:text-black/80"
                  }`}
                >
                  Reset Password
                </button>
              </div>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                    className="space-y-6 p-2"
                  >
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your email"
                              {...field}
                              className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                {...field}
                                className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4 pr-12"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-white"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 justify-center text-white font-semibold rounded-full h-12 text-base"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        "Sign In"
                      )}
                    </Button>

                    {/* Divider */}
                    {/* <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/20" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#24243E] px-4 text-black/60">
                          Or continue with
                        </span>
                      </div>
                    </div> */}

                    {/* Google Sign-in Button */}
                    <Button
                      type="button"
                      className="w-full bg-transparent hover:bg-blue-600 justify-center !text-center hover:text-white text-black border-0 rounded-full h-12 text-base font-medium cursor-pointer transition-all ease-in-out duration-500"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading}
                    >
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in with Google...
                        </>
                      ) : (
                        <>
                          <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          Continue with Google
                        </>
                      )}
                    </Button>

                    {/* Apple Sign-in Button */}
                    <Button
                      type="button"
                      className="w-full text-center bg-transparent justify-center hover:bg-blue-600 hover:text-white text-black border-0 rounded-full h-12 text-base font-medium cursor-pointer transition-all ease-in-out duration-500"
                      disabled={isGoogleLoading}
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Continue with Apple
                    </Button>

                    {/* <div className="text-center">
                      <Button
                        type="button"
                        onClick={() => setActiveTab("reset-password")}
                        className="text-black/80 hover:text-black text-sm underline"
                      >
                        Forgot your password?
                      </Button>
                    </div> */}

                    {/* Email verification reminder */}
                    {/* <Alert className="mt-4 bg-white/5 border-white/10">
                      <Mail className="h-4 w-4 text-black/80" />
                      <AlertDescription className="text-black/80">
                        Can't log in? Make sure you've verified your email
                        address. Check your inbox for the verification link.
                      </AlertDescription>
                    </Alert> */}
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Username
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Choose a username"
                              {...field}
                              className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email address"
                              {...field}
                              className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Choose a password"
                                {...field}
                                className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4 pr-12"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-black/60"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Confirm Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your password"
                                {...field}
                                className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4 pr-12"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-black/60"
                                onClick={() =>
                                  setShowConfirmPassword(!showConfirmPassword)
                                }
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    {/* Optional referral code */}
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        onClick={() => setShowReferral(!showReferral)}
                        className="text-black/80 hover:text-black text-sm underline px-0 bg-transparent hover:bg-transparent"
                      >
                        {showReferral
                          ? "Hide referral"
                          : "Have a referral code?"}
                      </Button>
                      {showReferral && (
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Enter referral code (optional)"
                            value={registerForm.watch("referralCode") || ""}
                            onChange={(e) => {
                              registerForm.setValue(
                                "referralCode",
                                e.target.value
                              );
                            }}
                            className="bg-blue-600 border-0 text-white placeholder:text-white/60 rounded-full h-12 px-4"
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full h-12 text-base"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>

                    {/* Divider */}
                    {/* <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/20" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#24243E] px-4 text-black/60">
                          Or continue with
                        </span>
                      </div>
                    </div> */}

                    {/* Google Sign-up Button */}
                    <Button
                      type="button"
                      className="w-full bg-transparent !text-center justify-center hover:bg-blue-700 hover:text-white transition-all ease-in-out duration-500  text-black border-0 rounded-full h-12 text-base font-medium cursor-pointer"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading}
                    >
                      {isGoogleLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing up with Google...
                        </>
                      ) : (
                        <>
                          <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          Continue with Google
                        </>
                      )}
                    </Button>

                    {/* Apple Sign-up Button */}
                    <Button
                      type="button"
                      className="w-full bg-transparent text-center justify-center hover:bg-blue-700 hover:text-white transition-all ease-in-out duration-500 text-black border-0 rounded-full h-12 text-base font-medium cursor-pointer"
                      disabled={isGoogleLoading}
                    >
                      <svg
                        className="mr-3 h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Continue with Apple
                    </Button>

                    {/* Email verification info */}
                    {/* <Alert className="mt-4 bg-white/5 border-white/10">
                      <Mail className="h-4 w-4 text-black/80" />
                      <AlertDescription className="text-black/80">
                        After creating your account, you'll receive a
                        verification email. Please check your inbox and click
                        the verification link to activate your account.
                      </AlertDescription>
                    </Alert> */}
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="reset-password">
                <Form {...resetPasswordForm}>
                  <form
                    onSubmit={resetPasswordForm.handleSubmit(
                      onResetPasswordSubmit
                    )}
                    className="space-y-6"
                  >
                    <Alert className="bg-white/5 border-white/10">
                      <Mail className="h-4 w-4 text-black/80" />
                      <AlertDescription className="text-black/80">
                        Enter your email address and we'll send you a link to
                        reset your password.
                      </AlertDescription>
                    </Alert>
                    <FormField
                      control={resetPasswordForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your email address"
                              {...field}
                              className="bg-white border-[#33334F] text-black placeholder:text-black/60 rounded-full h-12 px-4"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 justify-center text-white transition-all ease-in-out duration-500  font-semibold rounded-full h-12 text-base"
                      disabled={requestPasswordResetMutation.isPending}
                    >
                      {requestPasswordResetMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Reset Link"
                      )}
                    </Button>
                    {/* <div className="text-center">
                      <Button
                        type="button"
                        onClick={() => setActiveTab("login")}
                        className="text-black/80 hover:text-black text-sm underline"
                      >
                        Back to login
                      </Button>
                    </div> */}
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="new-password">
                <Form {...newPasswordForm}>
                  <form
                    onSubmit={newPasswordForm.handleSubmit(onNewPasswordSubmit)}
                    className="space-y-6"
                  >
                    <Alert className="bg-white/5 border-white/10">
                      <Lock className="h-4 w-4 text-black/80" />
                      <AlertDescription className="text-black/80">
                        Enter your new password below.
                      </AlertDescription>
                    </Alert>
                    <FormField
                      control={newPasswordForm.control}
                      name="token"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Reset Token
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter reset token"
                              {...field}
                              value={resetToken || field.value}
                              onChange={(e) => {
                                field.onChange(e);
                                setResetToken(e.target.value);
                              }}
                              className="bg-[#33334F] border-[#33334F] text-black placeholder:text-black/60 rounded-xl h-12 px-4"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newPasswordForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            New Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                {...field}
                                className="bg-[#33334F] border-[#33334F] text-black placeholder:text-black/60 rounded-xl h-12 px-4 pr-12"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 justify-center h-full px-3 py-2 hover:bg-transparent text-black/60"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={newPasswordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-black text-sm font-medium">
                            Confirm New Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm new password"
                                {...field}
                                className="bg-[#33334F] border-[#33334F] text-black placeholder:text-black/60 rounded-xl h-12 px-4 pr-12"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 justify-center top-0 h-full px-3 py-2 hover:bg-transparent text-black/60"
                                onClick={() =>
                                  setShowConfirmPassword(!showConfirmPassword)
                                }
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 justify-center text-black font-semibold rounded-xl h-12 text-base"
                      disabled={resetPasswordMutation.isPending}
                    >
                      {resetPasswordMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        "Reset Password"
                      )}
                    </Button>
                    <div className="text-center">
                      <Button
                        type="button"
                        onClick={() => setActiveTab("login")}
                        className="text-black/80 hover:text-black justify-center text-sm underline"
                      >
                        Back to login
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Phone Display - Hidden on mobile */}
      {/* Right side visual section */}
      <div className="hidden lg:block flex-1 relative z-[3] overflow-hidden">
        {/* ✅ Fixed logo at the top-right */}
        <Link href="/">
        <div className="fixed top-8 right-20 flex items-center gap-2 z-50">
          <img
            src="/images/trend-logo.png"
            alt="Trend Logo"
            className="h-10 w-10 object-contain"
          />
          <span className="text-black text-3xl font-semibold">Trend</span>
        </div>
        </Link>

        {/* ✅ Fixed-position phone image */}
        <div className="fixed right-0 bottom-0 w-[40%] h-auto z-40">
          <img
            src="/images/auth2.png"
            alt="Trend Mobile App"
            className="w-full h-auto object-contain select-none pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
