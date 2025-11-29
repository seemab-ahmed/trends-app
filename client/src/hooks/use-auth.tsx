import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { buildApiUrl } from '@/lib/api-config';
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { UserProfile } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { registerWithEmailAndPassword, sendPasswordReset, loginWithEmailAndPassword, logout as firebaseLogout, onAuthStateChange, getIdToken } from "../lib/firebase-auth";

import { API_ENDPOINTS } from "@/lib/api-config";
// Client-side User type (simplified from schema)
interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
}

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<void, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<void, Error, RegisterData>;
  verifyEmailMutation: UseMutationResult<{ message: string }, Error, { token: string }>;
  requestPasswordResetMutation: UseMutationResult<{ message: string }, Error, { email: string }>;
  resetPasswordMutation: UseMutationResult<{ message: string }, Error, ResetPasswordData>;
  refreshUserProfile: () => Promise<void>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  username: string;
  email: string;
  password: string;
};

type ResetPasswordData = {
  token: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Firebase authentication state
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Listen to Firebase authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setIsLoading(true);
      
      if (firebaseUser) {
        // Check if email is verified before proceeding
        if (!firebaseUser.emailVerified) {
          console.log('User email not verified, signing out...');
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }
        
        // User is signed in and email is verified
        try {
          // Check if we already have a user with database UUID
          const currentUser = user;
          const shouldPreserveDatabaseId = currentUser && 
            currentUser.id !== firebaseUser.uid && 
            currentUser.id.length === 36; // UUID length check
          
          // First set basic Firebase user data, but preserve database UUID if available
          const userData: User = {
            id: shouldPreserveDatabaseId ? currentUser.id : firebaseUser.uid,
            username: shouldPreserveDatabaseId ? currentUser.username : 'Loading...',
            email: firebaseUser.email!,
            emailVerified: firebaseUser.emailVerified,
            role: shouldPreserveDatabaseId ? currentUser.role : 'user' as const,
          };
          
          setUser(userData);
          
          // Fetch user profile from backend to get the correct username
          try {
            console.log('Fetching user profile from backend...');
            console.log('Firebase UID:', firebaseUser.uid);
            console.log('Firebase email:', firebaseUser.email);
            
            // Use the new endpoint that gets profile by email (no auth required)
            const response = await fetch(buildApiUrl(`/api/user/profile/email/${encodeURIComponent(firebaseUser.email!)}`));
            
            console.log('Profile response status:', response.status);
            console.log('Profile response headers:', response.headers);
            
            if (response.ok) {
              const profileData = await response.json();
              console.log('Profile data received:', profileData);
              
              // Only update user if we don't already have the correct database UUID
              if (!shouldPreserveDatabaseId || userData.id !== profileData.id) {
                // Update user with correct username and ID from backend
                const updatedUser = {
                  ...userData,
                  id: profileData.id, // Use database UUID instead of Firebase UID
                  username: profileData.username || 'Unknown User',
                  role: profileData.role || userData.role,
                };
                console.log('Updating user with:', updatedUser);
                setUser(updatedUser);
              } else {
                console.log('Preserving existing database UUID, not updating user');
              }
              setProfile(profileData);
            } else {
              console.warn('Profile response not ok:', response.status, response.statusText);
              const errorText = await response.text();
              console.warn('Profile error response:', errorText);
              // Set a fallback username if profile fetch fails
              // Try to extract a better username from display name or email
              let fallbackUsername = 'User';
              if (firebaseUser.displayName) {
                // Use display name if available
                fallbackUsername = firebaseUser.displayName;
              } else if (firebaseUser.email) {
                // Try to create a username from email
                const emailPrefix = firebaseUser.email.split('@')[0];
                // If email prefix looks like a name, use it, otherwise use default
                if (emailPrefix.length > 3 && !emailPrefix.includes('.')) {
                  fallbackUsername = emailPrefix;
                }
              }
              
              setUser({
                ...userData,
                username: fallbackUsername,
                // Preserve database UUID if we had one, otherwise keep Firebase UID as fallback
                id: shouldPreserveDatabaseId ? currentUser.id : userData.id,
              });
            }
          } catch (profileError) {
            console.warn('Failed to fetch user profile:', profileError);
            // Set a fallback username if profile fetch fails
            // Try to extract a better username from display name or email
            let fallbackUsername = 'User';
            if (firebaseUser.displayName) {
              // Use display name if available
              fallbackUsername = firebaseUser.displayName;
            } else if (firebaseUser.email) {
              // Try to create a username from email
              const emailPrefix = firebaseUser.email.split('@')[0];
              // If email prefix looks like a name, use it, otherwise use default
              if (emailPrefix.length > 3 && !emailPrefix.includes('.')) {
                fallbackUsername = emailPrefix;
              }
            }
            
            setUser({
              ...userData,
              username: fallbackUsername,
              // Preserve database UUID if we had one, otherwise keep Firebase UID as fallback
              id: shouldPreserveDatabaseId ? currentUser.id : userData.id,
            });
          }
          
          setError(null);
        } catch (error) {
          console.error('Error setting up user:', error);
          setError(error as Error);
        }
      } else {
        // User is signed out
        setUser(null);
        setProfile(null);
        setError(null);
      }
      
      setIsLoading(false);
    });
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Refresh profile when user changes to ensure username is always up to date
  useEffect(() => {
    if (user && !profile) {
      // Fetch user profile from backend to get the correct username
      const fetchProfile = async () => {
        try {
          // Use the new endpoint that gets profile by email (no auth required)
            const response = await fetch(buildApiUrl(`/api/user/profile/email/${encodeURIComponent(auth.currentUser?.email || '')}`));
          
          if (response.ok) {
            const profileData = await response.json();
            setUser({
              ...user,
              id: profileData.id || user.id, // Preserve database UUID
              username: profileData.username || user.username,
              role: profileData.role || user.role,
            });
            setProfile(profileData);

            // If we have a pending referral code captured at entry, attribute it once
            try {
              const pendingRef = localStorage.getItem('pendingReferralCode');
              if (pendingRef) {
                const token = await getIdToken();
                const res = await fetch(API_ENDPOINTS.REFERRAL_ACCEPT(), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  credentials: 'include',
                  body: JSON.stringify({ code: pendingRef })
                });
                if (res.ok) {
                  localStorage.removeItem('pendingReferralCode');
                  queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.REFERRAL_STATS()] });
                  queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.REFERRAL_INFO()] });
                }
              }
            } catch {}
          }
        } catch (error) {
          console.warn('Failed to fetch user profile:', error);
          // Set fallback username if profile fetch fails
          setUser({
            ...user,
            username: 'User', // Use default username
          });
        }
      };
      
      fetchProfile();
    }
  }, [user, profile]);
    


  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      try {
        // Use Firebase for login
        await loginWithEmailAndPassword(
          credentials.email, 
          credentials.password
        );
        // Note: User state is automatically updated by Firebase auth listener
      } catch (error: any) {
        console.error('Firebase login error:', error);
        throw new Error(error.message || 'Login failed');
      }
    },
    onSuccess: () => {
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      // Note: User state is automatically updated by Firebase auth listener
      // Redirect to home page after successful login
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      try {
        // Use Firebase for registration
        await registerWithEmailAndPassword(
          credentials.email, 
          credentials.password, 
          credentials.username
        );
        // Note: User state is automatically updated by Firebase auth listener
      } catch (error: any) {
        console.error('Firebase registration error:', error);
        throw new Error(error.message || 'Registration failed');
      }
    },
    onSuccess: () => {
      toast({
        title: "Registration successful",
        description: "Welcome! Please check your email to verify your account before logging in.",
      });
      
      // Note: Firebase handles email verification automatically
      // Users will receive a verification email from Firebase
      // Redirect to login page after successful registration
      setTimeout(() => {
        window.location.href = '/auth';
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const res = await apiRequest("POST", "/api/auth/verify-email", { token });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Email verification failed');
      }
      return await res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Email verified",
        description: data.message,
      });
      // Refresh user data to update emailVerified status
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Email verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const requestPasswordResetMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      try {
        // Use Firebase for password reset
        await sendPasswordReset(email);
        return { message: 'Password reset email sent successfully. Please check your inbox.' };
      } catch (error: any) {
        console.error('Firebase password reset error:', error);
        throw new Error(error.message || 'Password reset request failed');
      }
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Password reset requested",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Password reset failed');
      }
      return await res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Password reset successful",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Function to refresh user profile
  const refreshUserProfile = async () => {
    if (user) {
      try {
        // Use the new endpoint that gets profile by email (no auth required)
            const response = await fetch(buildApiUrl(`/api/user/profile/email/${encodeURIComponent(auth.currentUser?.email || '')}`));
        
        if (response.ok) {
          const profileData = await response.json();
          setUser({
            ...user,
            username: profileData.username || user.username,
            role: profileData.role || user.role,
          });
          setProfile(profileData);
        }
      } catch (error) {
        console.warn('Failed to refresh user profile:', error);
        // Set fallback username if profile fetch fails
        setUser({
          ...user,
          username: 'User', // Use default username
        });
      }
    }
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Use Firebase for logout
        await firebaseLogout();
        // Clear all query cache
        queryClient.clear();
      } catch (error: any) {
        console.error('Firebase logout error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user/profile"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        profile: profile ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        verifyEmailMutation,
        requestPasswordResetMutation,
        resetPasswordMutation,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
