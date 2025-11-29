import { db } from './db';
import { userProfiles, monthlyLeaderboards, userBadges, monthlyScores, users, predictions } from '../shared/schema';
import { eq, and, desc, asc, gte, lte, gt, inArray } from 'drizzle-orm';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalScore: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracyPercentage: number;
  badges: string[];
}

export interface MonthlyScoreEntry {
  monthYear: string;
  score: number;
  rank: number;
  totalPredictions: number;
  correctPredictions: number;
}

// Get current month-year string
function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get previous month-year string
function getPreviousMonthYear(): string {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
}

// Generate monthly leaderboard dynamically for a specific month
export async function generateMonthlyLeaderboard(monthYear: string): Promise<LeaderboardEntry[]> {
  try {
    console.log(`Generating leaderboard for month: ${monthYear}`);
    
    // Parse the month and year
    const [year, month] = monthYear.split('-').map(Number);
    
    // Get month boundaries in UTC
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    console.log(`Getting predictions from ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);
    
    // Get all predictions for the specified month
    const monthPredictions = await db
      .select({
        userId: predictions.userId,
        pointsAwarded: predictions.pointsAwarded,
        result: predictions.result,
        status: predictions.status,
        slotStart: predictions.slotStart,
        timestampCreated: predictions.timestampCreated,
      })
      .from(predictions)
      .where(
        and(
          inArray(predictions.status, ['active', 'evaluated']),
          gte(predictions.timestampCreated, startOfMonth),
          lte(predictions.timestampCreated, endOfMonth)
        )
      );

    console.log(`Found ${monthPredictions.length} predictions for ${monthYear}`);
    console.log(`Month predictions details:`, monthPredictions.map(p => ({
      userId: p.userId,
      timestampCreated: p.timestampCreated,
      status: p.status
    })));
    
    // Debug: Let's also check what predictions exist in the database
    const allPredictions = await db
      .select({
        userId: predictions.userId,
        slotStart: predictions.slotStart,
        timestampCreated: predictions.timestampCreated,
        status: predictions.status,
      })
      .from(predictions)
      .where(inArray(predictions.status, ['active', 'evaluated']))
      .limit(10);
    
    console.log(`Sample predictions in database:`, allPredictions.map(p => ({
      userId: p.userId,
      slotStart: p.slotStart,
      timestampCreated: p.timestampCreated,
      status: p.status
    })));

    // Group by user and calculate scores
    const userScores = new Map<string, {
      userId: string;
      totalScore: number;
      totalPredictions: number;
      correctPredictions: number;
    }>();

    monthPredictions.forEach(pred => {
      if (!userScores.has(pred.userId)) {
        userScores.set(pred.userId, {
          userId: pred.userId,
          totalScore: 0,
          totalPredictions: 0,
          correctPredictions: 0,
        });
      }

      const userScore = userScores.get(pred.userId)!;
      userScore.totalPredictions++;
      
      if (pred.pointsAwarded !== null) {
        userScore.totalScore += pred.pointsAwarded;
        if (pred.result === 'correct') {
          userScore.correctPredictions++;
        }
      }
    });

    // Get user information
    const userIds = Array.from(userScores.keys());
    const usersData = await db.query.users.findMany({
      where: inArray(users.id, userIds),
    });

    const userMap = new Map(usersData.map(userData => [userData.id, userData]));

    // Convert to leaderboard entries and sort by prediction count
    const allEntries = Array.from(userScores.values())
      .map(userScore => {
        const user = userMap.get(userScore.userId);
        const accuracyPercentage = userScore.totalPredictions > 0 
          ? (userScore.correctPredictions / userScore.totalPredictions) * 100 
          : 0;

        return {
          rank: 0, // Will be set after sorting
          userId: userScore.userId,
          username: user?.username || 'Unknown',
          totalScore: userScore.totalScore,
          totalPredictions: userScore.totalPredictions,
          correctPredictions: userScore.correctPredictions,
          accuracyPercentage: accuracyPercentage,
          badges: [], // No badges for dynamically generated data
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
    
    // Get the highest score
    const highestScore = allEntries.length > 0 ? allEntries[0].totalScore : 0;
    
    // Filter to include all users with the highest score
    const leaderboardEntries: LeaderboardEntry[] = allEntries
      .filter(entry => entry.totalScore === highestScore)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    console.log(`Generated leaderboard for ${monthYear} with ${leaderboardEntries.length} entries`);
    return leaderboardEntries;
  } catch (error) {
    console.error(`Error generating leaderboard for ${monthYear}:`, error);
    return []; // Return empty array on error
  }
}

  // Get monthly leaderboard (Top 10 with tie-breaking)
export async function getMonthlyLeaderboard(monthYear?: string): Promise<LeaderboardEntry[]> {
  const targetMonth = monthYear || getPreviousMonthYear();
  
  // First try to get data from monthly_leaderboards table
  const allLeaderboard = await db.query.monthlyLeaderboards.findMany({
    where: eq(monthlyLeaderboards.monthYear, targetMonth),
  });

  // If no data in monthly_leaderboards table, return empty array for now
  if (allLeaderboard.length === 0) {
    console.log(`No archived data for ${targetMonth}, returning empty array`);
    return [];
  }
  
  // Get all predictions for this month to get timestamps for tie-breaking
  const [year, month] = targetMonth.split('-').map(Number);
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  
  const monthPredictions = await db
    .select({
      userId: predictions.userId,
      evaluatedAt: predictions.evaluatedAt,
    })
    .from(predictions)
    .where(
      and(
        eq(predictions.status, 'evaluated'),
        gte(predictions.timestampCreated, startOfMonth),
        lte(predictions.timestampCreated, endOfMonth)
      )
    );
  
  // Map userId to earliest timestamp
  const userScoreTimestamps = new Map<string, Date>();
  for (const pred of monthPredictions) {
    if (pred.evaluatedAt) {
      const userId = pred.userId;
      const currentTimestamp = userScoreTimestamps.get(userId);
      if (!currentTimestamp || pred.evaluatedAt < currentTimestamp) {
        userScoreTimestamps.set(userId, pred.evaluatedAt);
      }
    }
  }
  
  // Sort by: 1) Total Score (desc), 2) Correct Predictions (desc), 3) Timestamp (asc), 4) UserId (asc)
  const sortedLeaderboard = allLeaderboard.sort((a, b) => {
    // 1. Sort by total score (descending)
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    // 2. Sort by correct predictions (descending)
    if (b.correctPredictions !== a.correctPredictions) {
      return b.correctPredictions - a.correctPredictions;
    }
    
    // 3. Sort by timestamp (ascending - earlier is better)
    const aTimestamp = userScoreTimestamps.get(a.userId)?.getTime() || Date.now();
    const bTimestamp = userScoreTimestamps.get(b.userId)?.getTime() || Date.now();
    if (aTimestamp !== bTimestamp) {
      return aTimestamp - bTimestamp;
    }
    
    // 4. Sort by userId alphabetically (ascending)
    return a.userId.localeCompare(b.userId);
  });
  
  // Take top 10 users (or all if less than 10)
  const leaderboard = sortedLeaderboard.slice(0, 10);

  // Get badges for each user
  const userIds = leaderboard.map(entry => entry.userId);
  let badges: Array<{ userId: string; badgeType: string }> = [];
  if (userIds.length > 0) {
    badges = await db.query.userBadges.findMany({
      where: eq(userBadges.monthYear, targetMonth),
    });
  }

  const badgeMap = new Map<string, string[]>();
  badges.forEach(badge => {
    if (!badgeMap.has(badge.userId)) {
      badgeMap.set(badge.userId, []);
    }
    badgeMap.get(badge.userId)!.push(badge.badgeType);
  });

  // Reassign ranks based on new sorting (1, 2, 3, etc.)
  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: entry.username,
    totalScore: entry.totalScore,
    totalPredictions: entry.totalPredictions,
    correctPredictions: entry.correctPredictions,
    accuracyPercentage: parseFloat(entry.accuracyPercentage?.toString() || '0'),
    badges: badgeMap.get(entry.userId) || [],
  }));
}

// Get user's rank for a specific month
export async function getUserRank(userId: string, monthYear?: string): Promise<number | null> {
  const targetMonth = monthYear || getPreviousMonthYear();
  
  const entry = await db.query.monthlyLeaderboards.findFirst({
    where: and(
      eq(monthlyLeaderboards.userId, userId),
      eq(monthlyLeaderboards.monthYear, targetMonth)
    ),
  });

  return entry?.rank || null;
}

// Get user's monthly score history
export async function getUserMonthlyScores(userId: string): Promise<MonthlyScoreEntry[]> {
  const scores = await db.query.monthlyScores.findMany({
    where: eq(monthlyScores.userId, userId),
    orderBy: [desc(monthlyScores.monthYear)],
  });

  return scores.map(score => ({
    monthYear: score.monthYear,
    score: score.score,
    rank: score.rank || 0,
    totalPredictions: score.totalPredictions,
    correctPredictions: score.correctPredictions,
  }));
}

// Get user's badges
export async function getUserBadges(userId: string): Promise<Array<{
  badgeType: string;
  monthYear: string;
  rank: number;
  totalScore: number;
}>> {
  const badges = await db.query.userBadges.findMany({
    where: eq(userBadges.userId, userId),
    orderBy: [desc(userBadges.monthYear)],
  });

  return badges.map(badge => ({
    badgeType: badge.badgeType,
    monthYear: badge.monthYear,
    rank: badge.rank || 0,
    totalScore: badge.totalScore || 0,
  }));
}

// Process monthly leaderboard (run at the beginning of each month)
export async function processMonthlyLeaderboard() {
  const previousMonth = getPreviousMonthYear();
  const currentMonth = getCurrentMonthYear();
  
  console.log(`Processing leaderboard for ${previousMonth}`);

  // Get all user profiles with their monthly scores
  const profiles = await db.query.userProfiles.findMany();
  
  // Get user data separately to avoid referencedTable issues
  const userIds = profiles.map(profile => profile.userId);
  const usersData = await db.query.users.findMany({
    where: inArray(users.id, userIds),
  });
  
  const userMap = new Map(usersData.map(user => [user.id, user]));
  
  // Combine profiles with user data
  const profilesWithUsers = profiles.map(profile => ({
    ...profile,
    user: userMap.get(profile.userId),
  }));

  // Sort by monthly score (descending)
  const sortedProfiles = profilesWithUsers
    .filter(profile => profile.monthlyScore > 0)
    .sort((a, b) => b.monthlyScore - a.monthlyScore);

  // Create leaderboard entries
  const leaderboardEntries = sortedProfiles.map((profile, index) => {
    const rank = index + 1;
    const accuracyPercentage = profile.totalPredictions > 0 
      ? (profile.correctPredictions / profile.totalPredictions) * 100 
      : 0;

    return {
      monthYear: previousMonth,
      userId: profile.userId,
      username: profile.user?.username || 'Unknown',
      rank,
      totalScore: profile.monthlyScore,
      totalPredictions: profile.totalPredictions,
      correctPredictions: profile.correctPredictions,
      accuracyPercentage: (Math.round(accuracyPercentage * 100) / 100).toString(),
    };
  });

  // Save leaderboard entries
  if (leaderboardEntries.length > 0) {
    await db.insert(monthlyLeaderboards).values(leaderboardEntries);
  }

  // Award ranking badges using the badge service
  try {
    const { awardRankingBadges } = await import('./badge-service');
    await awardRankingBadges(previousMonth);
  } catch (error) {
    console.error(`Error awarding ranking badges for ${previousMonth}:`, error);
    // Non-critical error, continue with leaderboard processing
  }

  // Save monthly scores for all usersTable
  const monthlyScoreEntries = profilesWithUsers.map(profile => ({
    userId: profile.userId,
    monthYear: previousMonth,
    score: profile.monthlyScore,
    rank: leaderboardEntries.find(entry => entry.userId === profile.userId)?.rank || null,
    totalPredictions: profile.totalPredictions,
    correctPredictions: profile.correctPredictions,
  }));

  if (monthlyScoreEntries.length > 0) {
    await db.insert(monthlyScores).values(monthlyScoreEntries);
  }

  // Reset monthly scores for all usersTable
  await db.update(userProfiles)
    .set({
      monthlyScore: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      lastMonthRank: null,
      updatedAt: new Date(),
    });

  // Update last month rank for usersTable who were in the leaderboard
  for (const entry of leaderboardEntries) {
    await db.update(userProfiles)
      .set({
        lastMonthRank: entry.rank,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, entry.userId));
  }

  console.log(`Monthly leaderboard processed. ${leaderboardEntries.length} usersTable ranked.`);
}

// Get current month leaderboard (live scores) - FIXED VERSION
export async function getCurrentMonthLeaderboard(): Promise<LeaderboardEntry[]> {
  // Get current month boundaries in Europe/Rome timezone
  const now = new Date();
  const romeTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Rome"}));
  
  // Compute month boundaries using UTC to match stored slotStart timestamps
  const startOfMonth = new Date(Date.UTC(romeTime.getFullYear(), romeTime.getMonth(), 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(romeTime.getFullYear(), romeTime.getMonth() + 1, 0, 23, 59, 59, 999));
  
  console.log(`Getting current month leaderboard from ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);
  
  // Import predictions table to avoid circular dependency
  const { predictions } = await import('../shared/schema');
  
  // Get all predictions for the current month (both active and evaluated)
  const currentMonthPredictions = await db
    .select({
      userId: predictions.userId,
      pointsAwarded: predictions.pointsAwarded,
      result: predictions.result,
      status: predictions.status,
      slotStart: predictions.slotStart,
      timestampCreated: predictions.timestampCreated,
    })
    .from(predictions)
    .where(
      and(
        inArray(predictions.status, ['active', 'evaluated']),
        gte(predictions.timestampCreated, startOfMonth),
        lte(predictions.timestampCreated, endOfMonth)
      )
    );
  
  console.log(`Found ${currentMonthPredictions.length} resolved predictions for current month`);
  
  // If no predictions found, return empty array (don't show stale data from profiles)
  if (currentMonthPredictions.length === 0) {
    console.log('No current month predictions found, returning empty leaderboard');
    return [];
  }
  
  console.log('Using main current month logic');
  
  // Aggregate predictions by user
  const userStats = new Map<string, {
    totalScore: number;
    totalPredictions: number;
    correctPredictions: number;
  }>();
  
  for (const pred of currentMonthPredictions) {
    if (!userStats.has(pred.userId)) {
      userStats.set(pred.userId, {
        totalScore: 0,
        totalPredictions: 0,
        correctPredictions: 0,
      });
    }
    
    const stats = userStats.get(pred.userId)!;
    stats.totalPredictions++;
    
    // For evaluated predictions, add points and count results
    if (pred.status === 'evaluated') {
      stats.totalScore += pred.pointsAwarded || 0;
      if (pred.result === 'correct') {
        stats.correctPredictions++;
      }
    }
    // For active predictions, they count towards total but don't contribute to score yet
  }
  
  // Convert to array and sort by prediction count
  const allEntries = Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      totalScore: stats.totalScore,
      totalPredictions: stats.totalPredictions,
      correctPredictions: stats.correctPredictions,
      accuracyPercentage: stats.totalPredictions > 0 
        ? (stats.correctPredictions / stats.totalPredictions) * 100 
        : 0,
    }))
    .filter(entry => entry.totalPredictions > 0); // Show usersTable with any predictions
  
  console.log('All entries before sorting:', allEntries.map(e => ({ userId: e.userId, totalScore: e.totalScore, totalPredictions: e.totalPredictions })));
  
  // Get timestamp when each user reached their current score for tie-breaking
  // Map userId to earliest timestamp of reaching current score
  const userScoreTimestamps = new Map<string, Date>();
  
  for (const pred of currentMonthPredictions) {
    if (pred.status === 'evaluated' && pred.evaluatedAt) {
      const userId = pred.userId;
      const currentTimestamp = userScoreTimestamps.get(userId);
      
      if (!currentTimestamp || pred.evaluatedAt < currentTimestamp) {
        userScoreTimestamps.set(userId, pred.evaluatedAt);
      }
    }
  }
  
  // Sort by: 1) Total Score (desc), 2) Correct Predictions (desc), 3) Timestamp (asc), 4) UserId (asc)
  const sortedEntries = allEntries.sort((a, b) => {
    // 1. Sort by total score (descending)
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    
    // 2. Sort by correct predictions (descending)
    if (b.correctPredictions !== a.correctPredictions) {
      return b.correctPredictions - a.correctPredictions;
    }
    
    // 3. Sort by timestamp (ascending - earlier is better)
    const aTimestamp = userScoreTimestamps.get(a.userId)?.getTime() || Date.now();
    const bTimestamp = userScoreTimestamps.get(b.userId)?.getTime() || Date.now();
    if (aTimestamp !== bTimestamp) {
      return aTimestamp - bTimestamp;
    }
    
    // 4. Sort by userId alphabetically (ascending)
    return a.userId.localeCompare(b.userId);
  });
  
  console.log('Sorted entries with tie-breaking:', sortedEntries.slice(0, 10).map(e => ({ 
    userId: e.userId, 
    totalScore: e.totalScore, 
    correctPredictions: e.correctPredictions,
    timestamp: userScoreTimestamps.get(e.userId)?.toISOString()
  })));
  
  // Take top 10 users (or all if less than 10)
  const leaderboardData = sortedEntries.slice(0, 10);
    
  console.log('Leaderboard data (all users with highest score):', leaderboardData.map(e => ({ userId: e.userId, totalScore: e.totalScore, totalPredictions: e.totalPredictions })));
  
  // Get user data for usernames
  const userIds = leaderboardData.map(entry => entry.userId);
  const usersData = await db.query.users.findMany({
    where: inArray(users.id, userIds),
  });
  
  const userMap = new Map(usersData.map(user => [user.id, user]));
  
  // Format the response
  const result = leaderboardData.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: userMap.get(entry.userId)?.username || 'Unknown',
    totalScore: entry.totalScore,
    totalPredictions: entry.totalPredictions,
    correctPredictions: entry.correctPredictions,
    accuracyPercentage: Math.round(entry.accuracyPercentage * 100) / 100,
    badges: [], // No badges for current month
  }));
  
  console.log(`getCurrentMonthLeaderboard returning ${result.length} entries:`, result.map(r => ({ username: r.username, totalPredictions: r.totalPredictions })));
  return result;
}

// Fallback function to show top 10 users with their current profiles
async function getAllUserProfilesLeaderboard(): Promise<LeaderboardEntry[]> {
  console.log('Getting all user profiles for fallback leaderboard');
  
  // Get all user profiles with user data
  const profilesWithUsers = await db
    .select({
      userId: userProfiles.userId,
      monthlyScore: userProfiles.monthlyScore,
      totalPredictions: userProfiles.totalPredictions,
      correctPredictions: userProfiles.correctPredictions,
      updatedAt: userProfiles.updatedAt,
      username: users.username,
      role: users.role,
    })
    .from(userProfiles)
    .innerJoin(users, eq(userProfiles.userId, users.id));
  
  console.log(`Found ${profilesWithUsers.length} user profiles`);
  
  // Sort by: 1) Monthly Score (desc), 2) Correct Predictions (desc), 3) UpdatedAt (asc), 4) UserId (asc)
  const sortedProfiles = profilesWithUsers.sort((a, b) => {
    // 1. Sort by monthly score (descending)
    const aScore = a.monthlyScore || 0;
    const bScore = b.monthlyScore || 0;
    if (bScore !== aScore) {
      return bScore - aScore;
    }
    
    // 2. Sort by correct predictions (descending)
    if (b.correctPredictions !== a.correctPredictions) {
      return b.correctPredictions - a.correctPredictions;
    }
    
    // 3. Sort by updatedAt timestamp (ascending - earlier is better)
    const aTime = a.updatedAt?.getTime() || Date.now();
    const bTime = b.updatedAt?.getTime() || Date.now();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    
    // 4. Sort by userId alphabetically (ascending)
    return a.userId.localeCompare(b.userId);
  });
  
  // Take top 10 users (or all if less than 10)
  const topUsers = sortedProfiles.slice(0, 10);
  
  console.log('getAllUserProfilesLeaderboard - top 10 users:', topUsers.map(p => ({ 
    username: p.username, 
    monthlyScore: p.monthlyScore, 
    correctPredictions: p.correctPredictions,
    totalPredictions: p.totalPredictions 
  })));
  
  // Convert to leaderboard format
  return topUsers.map((profile, index) => ({
    rank: index + 1,
    userId: profile.userId,
    username: profile.username || 'Unknown',
    totalScore: profile.monthlyScore || 0,
    totalPredictions: profile.totalPredictions || 0,
    correctPredictions: profile.correctPredictions || 0,
    accuracyPercentage: profile.totalPredictions > 0 
      ? (profile.correctPredictions / profile.totalPredictions) * 100 
      : 0,
    badges: [], // No badges for current month
    isAdmin: profile.role === 'admin',
  }));
}

// Get user's current month stats
export async function getUserCurrentMonthStats(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return null;
  }

  // Get user data separately
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  // Get current rank
  const allProfiles = await db.query.userProfiles.findMany({
    orderBy: [desc(userProfiles.monthlyScore)],
  });

  const currentRank = allProfiles.findIndex(p => p.userId === userId) + 1;

  const accuracyPercentage = profile.totalPredictions > 0 
    ? (profile.correctPredictions / profile.totalPredictions) * 100 
    : 0;

  return {
    userId: profile.userId,
    username: user?.username || 'Unknown',
    monthlyScore: profile.monthlyScore,
    totalPredictions: profile.totalPredictions,
    correctPredictions: profile.correctPredictions,
    accuracyPercentage: Math.round(accuracyPercentage * 100) / 100,
    currentRank,
    lastMonthRank: profile.lastMonthRank,
  };
}

// Get leaderboard statistics
export async function getLeaderboardStats() {
  const currentMonth = getCurrentMonthYear();
  const previousMonth = getPreviousMonthYear();

  // Get current month boundaries
  const now = new Date();
  const romeTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Rome"}));
  const startOfCurrentMonth = new Date(Date.UTC(romeTime.getFullYear(), romeTime.getMonth(), 1, 0, 0, 0, 0));
  const endOfCurrentMonth = new Date(Date.UTC(romeTime.getFullYear(), romeTime.getMonth() + 1, 0, 23, 59, 59, 999));
  
  // Get previous month boundaries
  const prevMonthDate = new Date(romeTime.getFullYear(), romeTime.getMonth() - 1, 1);
  const startOfPreviousMonth = new Date(Date.UTC(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1, 0, 0, 0, 0));
  const endOfPreviousMonth = new Date(Date.UTC(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0, 23, 59, 59, 999));

  const [currentMonthCount, previousMonthCount] = await Promise.all([
    // Count users who made predictions in current month
    db.select({ userId: predictions.userId })
      .from(predictions)
      .where(
        and(
          inArray(predictions.status, ['active', 'evaluated']),
          gte(predictions.timestampCreated, startOfCurrentMonth),
          lte(predictions.timestampCreated, endOfCurrentMonth)
        )
      )
      .then(results => new Set(results.map(r => r.userId)).size),
    
    // Count users who made predictions in previous month
    db.select({ userId: predictions.userId })
      .from(predictions)
      .where(
        and(
          inArray(predictions.status, ['active', 'evaluated']),
          gte(predictions.timestampCreated, startOfPreviousMonth),
          lte(predictions.timestampCreated, endOfPreviousMonth)
        )
      )
      .then(results => new Set(results.map(r => r.userId)).size),
  ]);

  console.log(`Leaderboard stats - Current month: ${currentMonthCount} participants, Previous month: ${previousMonthCount} participants`);

  return {
    currentMonth: {
      monthYear: currentMonth,
      participants: currentMonthCount,
    },
    previousMonth: {
      monthYear: previousMonth,
      participants: previousMonthCount,
    },
  };
}

// Schedule monthly leaderboard processing
export function scheduleMonthlyLeaderboardProcessing() {
  // Check if it's the first day of the month at 00:00 CEST
  const checkAndProcess = () => {
    const now = new Date();
    const cestOffset = 2; // CEST is UTC+2
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const cestTime = new Date(utc + (cestOffset * 3600000));
    
    // Check if it's the first day of the month at 00:00
    if (cestTime.getDate() === 1 && cestTime.getHours() === 0 && cestTime.getMinutes() === 0) {
      processMonthlyLeaderboard();
    }
  };

  // Check every minute
  setInterval(checkAndProcess, 60 * 1000);
  
  // Also check immediately on startup
  checkAndProcess();
} 

// Get current month countdown information
export function getCurrentMonthCountdown() {
  // Get current time in Europe/Rome timezone
  const now = new Date();
  const romeTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Rome"}));
  
  // End of current month (23:59:59 CEST)
  const endOfMonth = new Date(romeTime.getFullYear(), romeTime.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  // Calculate time remaining
  const timeRemaining = endOfMonth.getTime() - now.getTime();
  
  if (timeRemaining <= 0) {
    return {
      isExpired: true,
      message: "Month has ended",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      endDate: endOfMonth.toISOString(),
    };
  }
  
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
  
  return {
    isExpired: false,
    message: `Ends in: ${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} CEST`,
    days,
    hours,
    minutes,
    seconds,
    endDate: endOfMonth.toISOString(),
  };
} 