import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Redirect, useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ProfileEditForm from "@/components/profile-edit-form";
import PasswordChangeForm from "@/components/password-change-form";
import EmailChangeForm from "@/components/email-change-form";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Award,
  Calendar,
  Trophy,
  User2,
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Edit,
  Lock,
} from "lucide-react";
import { UserProfile, Prediction, UserBadge } from "@shared/schema";
import { API_ENDPOINTS } from "@/lib/api-config";

interface PredictionWithAsset extends Prediction {
  asset: {
    name: string;
    symbol: string;
    type: string;
  };
}

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [_, setLocation] = useLocation();
  const handleBack = () => setLocation("/");
  const { data: userProfile, isLoading: profileLoading } =
    useQuery<UserProfile>({
      queryKey: ["/api/user/profile"],
      enabled: !!user,
    });

  const { data: userPredictions, isLoading: predictionsLoading } = useQuery<
    PredictionWithAsset[]
  >({
    queryKey: [API_ENDPOINTS.PREDICTIONS()],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const { data: userBadges, isLoading: badgesLoading } = useQuery<UserBadge[]>({
    queryKey: [`/api/users/${user?.id}/badges`],
    enabled: !!user,
  });

  if (!user) return <Redirect to="/auth" />;

  const safePredictions = (
    Array.isArray(userPredictions) ? userPredictions : []
  ).filter((p) => p && p.asset && typeof p.asset === "object");

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

  const isEmailVerified = user.emailVerified;
  function renderPredictionTable(predictions, loading) {
    if (loading) {
      return (
        <div className="py-6 text-center">
          <Skeleton className="h-6 w-full" />
        </div>
      );
    }

    if (!predictions || predictions.length === 0) {
      return (
        <div className="py-6 text-center text-neutral-500">
          No predictions yet
        </div>
      );
    }

    return (
      <table className="min-w-full text-sm text-neutral-300">
        <thead className="bg-[#23272b] text-neutral-400 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Coin</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Direction</th>
            <th className="px-4 py-3 text-left font-medium">Result</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a2d33]">
          {predictions.map((p) => (
            <tr key={p.id} className="hover:bg-[#2a2d33]/50">
              <td className="px-4 py-3 font-medium text-black">
                {p.asset.name}
              </td>
              <td className="px-4 py-3 capitalize text-neutral-300">
                {p.status}
              </td>
              <td className="px-4 py-3">
                {p.direction === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </td>
              <td className="px-4 py-3">
                {p.result === "correct" ? (
                  <span className="text-green-400 font-semibold">
                    ✓ Correct
                  </span>
                ) : p.result === "incorrect" ? (
                  <span className="text-red-400 font-semibold">
                    ✗ Incorrect
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-4 py-3 text-neutral-400">
                {p.timestampCreated
                  ? new Date(p.timestampCreated).toLocaleDateString()
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="container max-w-7xl mx-auto px-6 py-6 spa">
        <section className="flex items-center gap-3 mb-16 md:hidden">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-200 group hover:bg-blue-600 transition"
          >
            <ArrowLeft className="h-5 w-5 text-black group-hover:text-black" />
          </button>
          <h1 className="text-2xl font text-black">Profile</h1>
        </section>
        <div className="grid grid-cols-1 lg:grid-cols-[32%_1fr] gap-8 items-start">
          {/* ✅ LEFT PANEL */}
          <Card className="relative  border-none rounded-3xl bg-white shadow-[0_0_10px_rgba(0,0,0,0.15)] text-black overflow-visible font-poppins">
            {/* Avatar */}
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
              <div className="relative h-24 w-24 rounded-full overflow-hidden shadow-lg ring-4 ring-blue-600 border-2 border-blue-600">
                {userProfile?.avatar ? (
                  <img
                    src={userProfile.avatar}
                    alt={user.username}
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-blue-600 text-white text-3xl font-semibold rounded-full">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Header */}
            <CardHeader className="pt-20 pb-4 text-center font-poppins">
              <CardTitle className="text-xl font-semibold">
                {user.username}
              </CardTitle>
              <CardDescription className="flex items-center justify-center text-neutral-400 text-sm mt-1">
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Joined{" "}
                {profileLoading
                  ? "..."
                  : profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Unknown"}
              </CardDescription>

              {/* Verification badge */}
              {isEmailVerified ? (
                <div className="mt-4 mb-4 px-4 py-1 bg-gray-200 rounded-full inline-block">
                  <span className="text-black text-sm font-medium">
                    Email Verified
                  </span>
                </div>
              ) : (
                <div className="mt-4 mb-4 px-4 py-1 bg-gray-200 rounded-full inline-block">
                  <span className="text-red text-sm font-medium">
                    Email Not Verified
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-center gap-4 mt-5 flex-wrap xl:flex-nowrap">
                <Button
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="w-40 p-1 bg-[#2563EB] !text-[12px] hover:bg-[#1D4ED8] text-white font-medium rounded-md shadow-sm"
                >
                  <Edit className="h-4 w-4 mr-0 " /> Edit Profile
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPasswordChange(true)}
                  className="w-40 p-1 border !text-[12px] border-[#3A3C42] bg-transparent text-black hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-md shadow-sm"
                >
                  <Lock className="h-4 w-4 mr-0 " /> Change Password
                </Button>
              </div>
            </CardHeader>

            {/* Main content */}
            <CardContent className="space-y-6 px-6 pb-6">
              {userProfile?.bio && (
                <section>
                  <h3 className="text-sm font-semibold mb-1">Bio</h3>
                  <p className="text-xs text-neutral-400">
                    {userProfile.bio || "No bio available."}
                  </p>
                </section>
              )}

              {/* Scores */}
              <section className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-black">Monthly Score</span>
                  <span className="font-semibold">
                    {userProfile?.monthlyScore || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-black">Total Score</span>
                  <span className="font-semibold">
                    {userProfile?.totalScore || 0}
                  </span>
                </div>
              </section>

              {/* Accuracy */}
              <section>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-black">Prediction Accuracy</span>
                  <span className="font-semibold">
                    {accuracyPercentage.toFixed(1)}%
                  </span>
                </div>
                <Progress value={accuracyPercentage} className="h-2" />
                <p className="text-xs text-neutral-500 mt-1">
                  {correctPredictions} correct out of {evaluatedPredictions}
                </p>
              </section>
              {/* Last Month Rank & Total Predictions */}
              <div className="grid grid-cols-2 gap-4 pt-3">
                {/* Last Month Rank */}
                <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-xl shadow-inner">
                  <Trophy className="h-5 w-5 mb-1 text-yellow-400" />
                  <div className="text-xl font-bold text-black">
                    {profileLoading ? (
                      <Skeleton className="h-6 w-8" />
                    ) : (
                      userProfile?.lastMonthRank || "-"
                    )}
                  </div>
                  <div className="text-xs text-black mt-1">
                    Last Month Rank
                  </div>
                </div>

                {/* Total Predictions */}
                <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-xl shadow-inner">
                  <Activity className="h-5 w-5 mb-1 text-blue-400" />
                  <div className="text-xl font-bold text-black">
                    {profileLoading ? (
                      <Skeleton className="h-6 w-8" />
                    ) : (
                      userProfile?.totalPredictions || 0
                    )}
                  </div>
                  <div className="text-xs text-black mt-1">
                    Total Predictions
                  </div>
                </div>
              </div>

              {/* Social */}
              <section className="pt-2">
                <h3 className="text-sm font-semibold mb-2">Social</h3>
                <div className="flex justify-between text-sm">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-2 text-blue-400" />
                    Followers
                  </div>
                  <button
                    onClick={() => setShowFollowers(true)}
                    className="hover:text-blue-400 font-medium"
                  >
                    {userProfile?.followersCount || 0}
                  </button>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <div className="flex items-center">
                    <User2 className="h-4 w-4 mr-2 text-green-400" />
                    Following
                  </div>
                  <button
                    onClick={() => setShowFollowing(true)}
                    className="hover:text-green-400 font-medium"
                  >
                    {userProfile?.followingCount || 0}
                  </button>
                </div>
              </section>

              {/* Account */}
              <section className="pt-2">
                <h3 className="text-sm font-semibold mb-2">Account</h3>
                <div className="flex items-center text-xs text-neutral-400 mb-1">
                  <Mail className="h-4 w-4 mr-2" />
                  {user.email}
                </div>
                <button
                  onClick={() => setShowEmailChange(true)}
                  className="flex items-center text-xs text-blue-400 hover:underline"
                >
                  <Edit className="h-3 w-3 mr-1" /> Change Email
                </button>
              </section>

              {/* Badges */}
              <section className="pt-2">
                <h3 className="text-sm font-semibold mb-2 flex items-center">
                  <Award className="h-4 w-4 mr-2 text-yellow-400" />
                  Achievement Badges
                </h3>
                {badgesLoading ? (
                  <Skeleton className="h-6 w-full" />
                ) : userBadges && userBadges.length > 0 ? (
                  <div className="space-y-2">
                    {userBadges.map((badge) => (
                      <Badge
                        key={badge.id}
                        variant="outline"
                        className="w-full justify-start bg-[#23272b] border-none text-neutral-300"
                      >
                        {badge.badgeType === "1st_place" && "🥇 "}
                        {badge.badgeType === "2nd_place" && "🥈 "}
                        {badge.badgeType === "3rd_place" && "🥉 "}
                        {badge.monthYear} - {badge.totalScore} pts
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500">
                    No badges earned yet
                  </p>
                )}
              </section>
            </CardContent>
          </Card>

          {/* ✅ RIGHT PANEL */}
          <Card className="rounded-3xl border-0 bg-white shadow-[0_0_10px_rgba(0,0,0,0.15)] text-black h-full flex flex-col">
            <CardHeader className="flex items-baseline pb-3 border-b border-gray-200 mb-5">
              <CardTitle className="text-lg font-semibold text-black">
                Latest Activity
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="w-full grid grid-cols-4 mb-4 bg-gray-300 rounded-xl p-1 px-3">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-[#2563EB] text-black data-[state=active]:text-white text-sm font-medium"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="active"
                    className="text-sm font-medium text-black data-[state=active]:bg-[#2563EB] data-[state=active]:text-white"
                  >
                    Active
                  </TabsTrigger>
                  <TabsTrigger
                    value="evaluated"
                    className="text-sm font-medium text-black data-[state=active]:bg-[#2563EB] data-[state=active]:text-white"
                  >
                    Evaluated
                  </TabsTrigger>
                  <TabsTrigger
                    value="correct"
                    className="text-sm font-medium text-black data-[state=active]:bg-[#2563EB] data-[state=active]:text-white"
                  >
                    Correct
                  </TabsTrigger>
                </TabsList>

                {/* ✅ All Predictions */}
                <TabsContent value="all" className="overflow-x-auto rounded-lg">
                  {renderPredictionTable(safePredictions, predictionsLoading)}
                </TabsContent>

                {/* ✅ Active Predictions */}
                <TabsContent
                  value="active"
                  className="overflow-x-auto rounded-lg"
                >
                  {renderPredictionTable(
                    safePredictions.filter(
                      (p) => p.status?.toLowerCase().trim() === "active"
                    ),
                    predictionsLoading
                  )}
                </TabsContent>

                {/* ✅ Evaluated Predictions */}
                <TabsContent
                  value="evaluated"
                  className="overflow-x-auto rounded-lg"
                >
                  {renderPredictionTable(
                    safePredictions.filter(
                      (p) => p.status?.toLowerCase().trim() === "evaluated"
                    ),
                    predictionsLoading
                  )}
                </TabsContent>

                {/* ✅ Correct Predictions */}
                <TabsContent
                  value="correct"
                  className="overflow-x-auto rounded-lg"
                >
                  {renderPredictionTable(
                    safePredictions.filter(
                      (p) =>
                        p.status?.toLowerCase().trim() === "evaluated" &&
                        p.result?.toLowerCase().trim() === "correct"
                    ),
                    predictionsLoading
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* ✅ Followers Modal */}
        <Dialog open={showFollowers} onOpenChange={setShowFollowers}>
          <DialogContent className="max-w-md bg-[#1E1F25] border border-[#2C2F36] text-black rounded-xl backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-black text-lg">
                Followers
              </DialogTitle>
            </DialogHeader>
            {userProfile?.followers && userProfile.followers.length > 0 ? (
              <ul className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                {userProfile.followers.map((follower: any) => (
                  <li
                    key={follower.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-[#2C2F36]/70 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={follower.avatar || "/images/default-avatar.png"}
                        alt={follower.username}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <span className="text-sm">{follower.username}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-black mt-2">No followers yet</p>
            )}
          </DialogContent>
        </Dialog>

        {/* ✅ Following Modal */}
        <Dialog open={showFollowing} onOpenChange={setShowFollowing}>
          <DialogContent className="max-w-md bg-[#1E1F25] border border-[#2C2F36] text-black rounded-xl backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-black text-lg">
                Following
              </DialogTitle>
            </DialogHeader>
            {userProfile?.following && userProfile.following.length > 0 ? (
              <ul className="space-y-2 mt-2 max-h-60 overflow-y-auto">
                {userProfile.following.map((followed: any) => (
                  <li
                    key={followed.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-[#2C2F36]/70 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={followed.avatar || "/images/default-avatar.png"}
                        alt={followed.username}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <span className="text-sm">{followed.username}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400 mt-2">
                Not following anyone yet
              </p>
            )}
          </DialogContent>
        </Dialog>
      </main>
      {/* ✅ Custom Modal System */}
      {isEditing && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setIsEditing(false)} // close on background click
        >
          <div
            className="max-w-xl w-full bg-gray-200 border border-gray-200 text-black rounded-xl p-6 shadow-xl font-poppins"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
          >
            <ProfileEditForm
              currentBio={userProfile?.bio || null}
              username={user.username}
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </div>
      )}

      {showPasswordChange && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setShowPasswordChange(false)}
        >
          <div
            className="max-w-xl w-full bg-gray-300 border border-0 text-black rounded-xl p-6 shadow-xl font-poppins"
            onClick={(e) => e.stopPropagation()}
          >
            <PasswordChangeForm onCancel={() => setShowPasswordChange(false)} />
          </div>
        </div>
      )}

      {showEmailChange && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
          onClick={() => setShowEmailChange(false)}
        >
          <div
            className="max-w-xl w-full bg-gray-300 border border-0 text-black rounded-xl p-6 shadow-xl font-poppins"
            onClick={(e) => e.stopPropagation()}
          >
            <EmailChangeForm onCancel={() => setShowEmailChange(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
