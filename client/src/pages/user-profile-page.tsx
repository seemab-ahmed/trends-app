import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Redirect } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  User2,
  Calendar,
  TrendingUp,
  Star,
  Trophy,
  Users,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Clock,
  Target,
} from "lucide-react";
import AppHeader from "../components/app-header";
import FollowButton from "../components/follow-button";
import { useAuth } from "../hooks/use-auth";
import { getAuthToken } from "../lib/queryClient";
import { buildApiUrl } from "../lib/api-config";
import BadgeDisplay from "../components/badge-display";

interface UserProfile {
  id: string;
  username: string;
  email?: string;
  createdAt: string;
  role: string;
  emailVerified: boolean;
  bio?: string;
  avatar?: string;
  monthlyScore: number;
  totalScore: number;
  totalPredictions: number;
  correctPredictions: number;
  followersCount: number;
  followingCount: number;
  lastMonthRank?: number;
  isFollowing: boolean;
}

interface PredictionWithAsset {
  id: string;
  userId: string;
  assetId: string;
  asset: {
    name: string;
    symbol: string;
    type: string;
  };
  direction: "up" | "down";
  duration: "24h" | "7d" | "30d";
  slotNumber: number;
  slotStart: Date;
  slotEnd: Date;
  timestampCreated: Date;
  timestampExpiration: Date;
  status: "active" | "expired" | "evaluated";
  result: "pending" | "correct" | "incorrect";
  pointsAwarded: number | null;
  priceStart: number | null;
  priceEnd: number | null;
}

interface UserBadge {
  id: string;
  userId: string;
  badgeType: string;
  monthYear: string;
  createdAt: Date;
}

interface MonthlyScore {
  id: string;
  userId: string;
  monthYear: string;
  totalScore: number;
  rank: number;
  createdAt: Date;
}

export default function UserProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const encodedUsername = username || "";

  // Debug logging
  console.log("UserProfilePage: Component rendered with username:", username);

  // Fetch user profile (with follow status if authenticated)
  const {
    data: userProfile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery<UserProfile>({
    queryKey: [
      `/api/user/${encodeURIComponent(encodedUsername)}`,
      currentUser?.id,
    ], // Include current user to trigger refetch when auth changes
    enabled: !!username,
    refetchOnWindowFocus: true,
    staleTime: 30000, // Cache for 30 seconds
    queryFn: async () => {
      console.log("UserProfilePage: Fetching user profile for:", username);

      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const apiUrl = buildApiUrl(
        `/api/user/${encodeURIComponent(encodedUsername)}`
      );
      console.log("UserProfilePage: API URL:", apiUrl);

      const response = await fetch(apiUrl, {
        headers,
      });
      console.log("UserProfilePage: Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("UserProfilePage: API Error Response:", {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `Failed to fetch user profile: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();
      console.log("UserProfilePage: User profile data received:", data);
      console.log("UserProfilePage: isFollowing from API:", data.isFollowing);
      console.log(
        "UserProfilePage: followersCount from API:",
        data.followersCount
      );
      console.log(
        "UserProfilePage: Full profile data keys:",
        Object.keys(data)
      );
      return data;
    },
  });

  // Force refetch when component mounts to ensure fresh data
  useEffect(() => {
    if (username) {
      console.log("UserProfilePage: Forcing refetch for username:", username);
      refetchProfile();
    }
  }, [username, refetchProfile]);

  // Force refetch when currentUser changes to get updated follow status
  useEffect(() => {
    if (username && currentUser?.username) {
      console.log(
        "UserProfilePage: Current user changed, refetching profile for updated follow status"
      );
      refetchProfile();
    }
  }, [currentUser?.username, username, refetchProfile]);

  // Fetch user predictions
  const isOwnProfileForQuery = userProfile?.username === currentUser?.username;
  const actualIsFollowing = userProfile?.isFollowing || false;
  const canViewPreds = !!(actualIsFollowing || isOwnProfileForQuery);

  // Debug follow status
  console.log("UserProfilePage: Follow status debug:", {
    username: userProfile?.username,
    currentUser: currentUser?.username,
    isOwnProfile: isOwnProfileForQuery,
    userProfileIsFollowing: userProfile?.isFollowing,
    actualIsFollowing: actualIsFollowing,
    canViewPreds: canViewPreds,
  });
  const { data: userPredictions, isLoading: predictionsLoading } = useQuery<
    PredictionWithAsset[]
  >({
    queryKey: [
      `/api/user/${encodeURIComponent(encodedUsername)}/predictions`,
      actualIsFollowing,
      currentUser?.username,
    ],
    enabled: !!username, // Always enabled, let backend handle authorization
    refetchOnWindowFocus: true,
    queryFn: async () => {
      console.log("UserProfilePage: Fetching predictions for:", username);
      console.log("UserProfilePage: Follow status when fetching predictions:", {
        isFollowing: actualIsFollowing,
        isOwnProfile: isOwnProfileForQuery,
        canView: canViewPreds,
      });
      // Ensure we have a token before requesting (avoids early 403 due to race)
      let token = await getAuthToken();
      if (!token) {
        await new Promise((r) => setTimeout(r, 300));
        token = await getAuthToken();
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      let response = await fetch(
        buildApiUrl(
          `/api/user/${encodeURIComponent(encodedUsername)}/predictions`
        ),
        {
          headers,
        }
      );
      if (response.status === 403) {
        console.warn(
          "UserProfilePage: Predictions fetch forbidden (403). Retrying once after ensuring token..."
        );
        await new Promise((r) => setTimeout(r, 300));
        response = await fetch(
          buildApiUrl(
            `/api/user/${encodeURIComponent(encodedUsername)}/predictions`
          ),
          {
            headers,
          }
        );
        if (response.status === 403) {
          console.warn(
            "UserProfilePage: Predictions still forbidden after retry. Returning empty list."
          );
          return [] as PredictionWithAsset[];
        }
      }
      const data = await response.json();
      console.log("UserProfilePage: Predictions data received:", data);
      return Array.isArray(data) ? data : [];
    },
  });

  // Fetch user badges
  const { data: userBadges, isLoading: badgesLoading } = useQuery<UserBadge[]>({
    queryKey: [`/api/user/${encodeURIComponent(encodedUsername)}/badges`],
    enabled: !!username,
  });

  // Fetch monthly scores
  const { data: monthlyScores, isLoading: scoresLoading } = useQuery<
    MonthlyScore[]
  >({
    queryKey: [`/api/user/${encodeURIComponent(encodedUsername)}/scores`],
    enabled: !!username,
  });

  // Follow/Unfollow mutation
  const followMutation = useMutation({
    mutationFn: async ({
      username,
      follow,
    }: {
      username: string;
      follow: boolean;
    }) => {
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      if (follow) {
        return fetch(
          buildApiUrl(
            `/api/user/${encodeURIComponent(encodedUsername)}/follow`
          ),
          {
            method: "POST",
            headers,
          }
        );
      } else {
        return fetch(
          buildApiUrl(
            `/api/user/${encodeURIComponent(encodedUsername)}/follow`
          ),
          {
            method: "DELETE",
            headers,
          }
        );
      }
    },
    onSuccess: () => {
      console.log(
        "UserProfilePage: Follow mutation successful, invalidating queries"
      );
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({
        queryKey: [`/api/user/${encodeURIComponent(encodedUsername)}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });

      // Force refetch to ensure data is updated
      setTimeout(() => {
        console.log(
          "UserProfilePage: Refetching profile after follow mutation"
        );
        refetchProfile();
      }, 100);
    },
  });

  // Handle loading state
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <p className="text-muted-foreground">Fetching user profile...</p>
          </div>
        </main>
      </div>
    );
  }

  // Handle errors
  if (profileError) {
    console.error("UserProfilePage: Profile error:", profileError);
    return (
      <div className="min-h-screen bg-background">
        <main className="container max-w-6xl mx-auto px-4 py-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
            <p className="text-muted-foreground">
              The user you're looking for doesn't exist.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Error: {profileError.message}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // If viewing own profile, redirect to profile page
  if (
    userProfile &&
    currentUser &&
    userProfile.username === currentUser.username
  ) {
    return <Redirect to="/profile" />;
  }

  const isOwnProfile = userProfile?.username === currentUser?.username;
  const canViewPredictions = actualIsFollowing || isOwnProfile;

  // Debug logging
  console.log("UserProfilePage: Follow status debug:", {
    username: userProfile?.username,
    currentUser: currentUser?.username,
    isOwnProfile,
    isFollowing: actualIsFollowing,
    canViewPredictions,
    userProfileData: userProfile,
  });
  // Ensure userPredictions is an array before filtering
  const safePredictions = Array.isArray(userPredictions) ? userPredictions : [];
  console.log(
    "UserProfilePage: userPredictions type:",
    typeof userPredictions,
    "isArray:",
    Array.isArray(userPredictions),
    "data:",
    userPredictions
  );

  const activePredictions =
    safePredictions.filter((p) => p.status === "active").length || 0;
  const evaluatedPredictions =
    safePredictions.filter((p) => p.status === "evaluated").length || 0;
  const correctPredictions =
    safePredictions.filter((p) => p.result === "correct").length || 0;
  const accuracyPercentage =
    evaluatedPredictions > 0
      ? (correctPredictions / evaluatedPredictions) * 100
      : 0;

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />
      <main className="container max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="space-y-6 md:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-24 w-24 mb-4">
                    <AvatarFallback className="bg-blue-500 text-3xl text-white">
                      {userProfile?.username?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <CardTitle className="text-xl">
                    {userProfile?.username || "Loading..."}
                  </CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    Joined{" "}
                    {profileLoading
                      ? "..."
                      : userProfile
                      ? (() => {
                          try {
                            return new Date(
                              userProfile.createdAt
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            });
                          } catch (error) {
                            return "Unknown date";
                          }
                        })()
                      : "..."}
                  </CardDescription>
                  {userProfile?.emailVerified && (
                    <Badge variant="outline" className="mt-2 bg-primary/10">
                      <Check className="h-3 w-3 mr-1" /> Email Verified
                    </Badge>
                  )}
                  {userProfile?.role === "admin" && (
                    <Badge
                      variant="outline"
                      className="mt-2 bg-red-500/10 text-red-500"
                    >
                      <Star className="h-3 w-3 mr-1" /> Admin
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Follow Button */}
                  {currentUser && !isOwnProfile && (
                    <div className="flex justify-center">
                      {console.log(
                        "UserProfilePage: Rendering FollowButton with:",
                        {
                          userId: userProfile?.id,
                          username: userProfile?.username,
                          isFollowing: actualIsFollowing,
                          currentUserId: currentUser?.id,
                        }
                      )}
                      <FollowButton
                        userId={userProfile?.id || ""}
                        username={userProfile?.username || ""}
                        initialFollowing={actualIsFollowing} classname="hover:bg-blue-600"
                      />
                    </div>
                  )}

                  {/* Bio */}
                  {console.log("UserProfilePage: Bio debug:", {
                    userProfile: userProfile,
                    bio: userProfile?.bio,
                    hasBio: !!userProfile?.bio,
                    bioLength: userProfile?.bio?.length,
                  })}
                  {userProfile?.bio && (
                    <div>
                      <div className="text-sm font-medium mb-1">Bio</div>
                      <div className="text-sm text-muted-foreground">
                        {userProfile.bio}
                      </div>
                    </div>
                  )}

                  {/* Monthly Score */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-medium">Monthly Score</div>
                      <div className="text-sm font-bold">
                        {profileLoading ? (
                          <Skeleton className="h-4 w-12" />
                        ) : (
                          userProfile?.monthlyScore || 0
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {userProfile?.lastMonthRank
                        ? `Last month: Rank #${userProfile.lastMonthRank}`
                        : "No previous rank"}
                    </div>
                  </div>

                  {/* Total Score */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-medium">Total Score</div>
                      <div className="text-sm font-bold">
                        {profileLoading ? (
                          <Skeleton className="h-4 w-12" />
                        ) : (
                          userProfile?.totalScore || 0
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Followers/Following */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {profileLoading ? (
                          <Skeleton className="h-5 w-8 mx-auto" />
                        ) : (
                          userProfile?.followersCount || 0
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Followers
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {profileLoading ? (
                          <Skeleton className="h-5 w-8 mx-auto" />
                        ) : (
                          userProfile?.followingCount || 0
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Following
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            {userBadges && userBadges.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Trophy className="h-5 w-5 mr-2 text-black" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BadgeDisplay badges={userBadges} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-gray-300 ">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="predictions">Predictions</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 py-5 px-2 ">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <Target className="h-8 w-8 text-blue-500 mr-3" />
                        <div>
                          <div className="text-2xl font-bold">
                            {profileLoading ? (
                              <Skeleton className="h-7 w-12" />
                            ) : (
                              userProfile?.totalPredictions || 0
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Total Predictions
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-green-500 mr-3" />
                        <div>
                          <div className="text-2xl font-bold">
                            {profileLoading ? (
                              <Skeleton className="h-7 w-12" />
                            ) : (
                              userProfile?.correctPredictions || 0
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Correct Predictions
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <Star className="h-8 w-8 text-yellow-500 mr-3" />
                        <div>
                          <div className="text-2xl font-bold">
                            {profileLoading ? (
                              <Skeleton className="h-7 w-12" />
                            ) : userProfile?.totalPredictions ? (
                              (
                                (userProfile.correctPredictions /
                                  userProfile.totalPredictions) *
                                100
                              ).toFixed(1)
                            ) : (
                              "0"
                            )}
                            %
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Accuracy
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Active Predictions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-blue-500" />
                      Active Predictions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {canViewPredictions ? (
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-500">
                          {activePredictions}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Currently active
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <EyeOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Follow to view predictions
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="predictions" className="space-y-6">
                {canViewPredictions ? (
                  safePredictions && safePredictions.length > 0 ? (
                    <div className="space-y-4">
                      {safePredictions.map((prediction) => (
                        <PredictionCard
                          key={prediction.id}
                          prediction={prediction}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="text-center py-8">
                        <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          No predictions found
                        </p>
                      </CardContent>
                    </Card>
                  )
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <EyeOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-2">
                        Predictions are private
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Follow this user to view their prediction history
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                {monthlyScores && monthlyScores.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(monthlyScores || []).slice(0, 6).map((score) => (
                          <div
                            key={score.id}
                            className="flex justify-between items-center p-3 border rounded-lg"
                          >
                            <div>
                              <div className="font-medium">
                                {score.monthYear}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Rank #{score.rank}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {score.totalScore} pts
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">
                        No historical data available
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

function PredictionCard({ prediction }: { prediction: PredictionWithAsset }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-blue-500">
            Active
          </Badge>
        );
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "evaluated":
        return <Badge variant="outline">Evaluated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "correct":
        return (
          <Badge variant="default" className="bg-green-500">
            Correct
          </Badge>
        );
      case "incorrect":
        return <Badge variant="destructive">Incorrect</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === "up" ? (
      <ArrowUp className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowDown className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {getDirectionIcon(prediction.direction)}
              <div className="flex flex-col">
                <span className="font-medium">{prediction.asset.name}</span>
                <span className="text-xs text-muted-foreground">
                  {prediction.asset.symbol}
                </span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {prediction.duration} • Slot {prediction.slotNumber}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(prediction.status)}
            {prediction.status === "evaluated" &&
              getResultBadge(prediction.result)}
            {prediction.pointsAwarded !== null && (
              <span
                className={`text-sm font-medium ${
                  prediction.pointsAwarded >= 0
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {prediction.pointsAwarded >= 0 ? "+" : ""}
                {prediction.pointsAwarded}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Created: {new Date(prediction.timestampCreated).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
