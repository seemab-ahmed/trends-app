import express from "express";
import { z } from "zod";
import { db } from "./db";
import {
  users,
  emailVerifications,
  predictions,
  assets,
  userProfiles,
  slotConfigs,
  userFollows,
  userBadges,
} from "../shared/schema";
import { eq, and, sql, gte, lte, inArray, desc, gt } from "drizzle-orm";
import { Client } from "pg";
import jwt from "jsonwebtoken";
import WebSocketService from "./websocket-service";
import { getAssetBySymbol, getCurrentPrice } from "./price-service";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

// Helper function to safely extract user from authenticated requests
const requireUser = (req: express.Request) => {
  if (!req.user) {
    throw new Error("User not found in request");
  }
  return req.user;
};

// Helper function to get user with full profile including email verification status
const requireUserWithProfile = async (req: express.Request) => {
  if (!req.user) {
    throw new Error("User not found in request");
  }

  // Get full user profile from database
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.user.userId),
  });

  if (!user) {
    throw new Error("User not found in database");
  }

  return user;
};
import {
  registerUser,
  loginUser,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  extractUserFromToken,
  isAdmin,
  isAuthenticated,
  comparePassword,
  hashPassword,
} from "./auth";
import {
  generateVerificationToken,
  sendVerificationEmail,
} from "./email-service";
import {
  createPrediction,
  getSentimentData,
  evaluateExpiredPredictions,
  getUserPredictionStats,
  getUserPredictions,
} from "./prediction-service";
import { getAdminAuth } from "./firebase-admin";
import { getUserByEmail } from "./user-service";
import crypto from "crypto";
import {
  getActiveSlot,
  getAllSlots,
  getNextSlot,
  initializeSlotConfigs,
  getEnhancedActiveSlot,
  getEnhancedValidSlots,
} from "./slot-service";
import {
  getCurrentActiveSlot as getActiveSlotLuxon,
  getAllSlotsForDuration as getAllSlotsLuxon,
} from "./lib/slots";
import {
  getAssetPrice,
  getAssetPriceHistory,
  getAllAssets,
  initializeDefaultAssets,
  updateForexPrices,
} from "./price-service";
import { assetSuggestions, assets as assetTable } from "../shared/schema";
import {
  getMonthlyLeaderboard,
  getCurrentMonthLeaderboard,
  getCurrentMonthCountdown,
  getUserCurrentMonthStats,
  getUserRank,
  getUserMonthlyScores,
  getUserBadges,
  getLeaderboardStats,
} from "./leaderboard-service";
import {
  getUserById,
  getUserProfile,
  getUserProfileByUsername,
  updateUserProfile,
  followUser,
  unfollowUser,
  getFollowing,
  getFollowers,
  searchUsers,
  getUserStats,
  getUsersByRank,
  getPublicUserProfile,
  isFollowing,
} from "./user-service";
import {
  getAdminStats,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getAllPredictions,
  getAllPredictionsWithFilters,
  manuallyEvaluatePrediction,
  getAllAssets as getAdminAssets,
  updateAsset,
  addAsset,
  getAssetPriceHistory as getAdminAssetPriceHistory,
  getAllPricesWithFilters,
  getLeaderboardData,
  getBadgeData,
  triggerPriceUpdate,
  getSystemHealth,
  updateUser,
  verifyUserEmail,
  deactivateUser,
  activateUser,
  getUnverifiedUsers,
  updateAssetPrice,
  getMonthlyLeaderboardStats,
  getTopAssetsByVolume,
  getActiveSlots,
} from "./admin-service";

const router = express.Router();

// WebSocket service instance (will be set by the main server)
let wsService: WebSocketService | null = null;

// Function to set WebSocket service instance
export function setWebSocketService(service: WebSocketService) {
  wsService = service;
}

// Attempt to resolve authenticated user from either backend JWT or Firebase ID token
async function getAuthenticatedDbUser(req: express.Request) {
  // Try backend JWT first
  const authHeader = req.headers.authorization;
  const jwtUser = extractUserFromToken(authHeader);
  if (jwtUser) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, jwtUser.userId),
    });
    if (dbUser) return dbUser;
  }

  // Fallback to Firebase ID token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const admin = await getAdminAuth();
      const decoded = await admin.verifyIdToken(token);
      if (decoded?.email) {
        // Find or create local user by email
        let dbUser = await db.query.users.findFirst({
          where: eq(users.email, decoded.email),
        });
        if (!dbUser) {
          const usernameBase = (
            decoded.name ||
            decoded.email.split("@")[0] ||
            "user"
          )
            .toLowerCase()
            .replace(/[^a-z0-9_\-]+/g, "");
          const username = usernameBase || "user";
          const [created] = await db
            .insert(users)
            .values({
              username,
              email: decoded.email,
              password: "firebase-user",
              emailVerified: true,
              role: "user",
            })
            .returning();
          await db.insert(userProfiles).values({ userId: created.id });
          dbUser = created;
        }
        return dbUser;
      }
    } catch {}
  }

  return null;
}

// Helper to compute global sentiment across all assets for a duration
async function computeGlobalSentimentResponse(duration: string) {
  // Use fixed calendar boundaries in CEST:
  // short: Mon→Sun, medium: calendar month, long: calendar quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec)
  const { getFixedCESTBoundaries } = await import("./slot-service");

  let start: Date;
  let end: Date;
  try {
    const boundaries = getFixedCESTBoundaries(duration as any);
    start = boundaries.start;
    end = boundaries.end;
  } catch {
    // Fallback to a sane default if duration is invalid
    const now = new Date();
    const windowMsMap: Record<string, number> = {
      short: 7 * 24 * 60 * 60 * 1000,
      medium: 30 * 24 * 60 * 60 * 1000,
      long: 90 * 24 * 60 * 60 * 1000,
    } as const;
    const ms =
      windowMsMap[duration as "short" | "medium" | "long"] || windowMsMap.short;
    start = new Date(now.getTime() - ms);
    end = now;
  }

  // Aggregate across ALL predictions within [start,end], regardless of their individual duration
  let up = 0;
  let down = 0;
  try {
    const rows = await db.execute(sql`
      SELECT direction, COUNT(*)::int AS count
      FROM predictions
      WHERE timestamp_created >= ${start}
        AND timestamp_created <= ${end}
        AND status IN ('active', 'evaluated')
      GROUP BY direction
    `);
    for (const r of (rows.rows || []) as any[]) {
      if (r.direction === "up") up = Number(r.count || 0);
      else if (r.direction === "down") down = Number(r.count || 0);
    }
  } catch (e) {
    // Safe fallback via ORM if raw fails
    const preds = await db.query.predictions.findMany({
      where: and(
        gte(predictions.timestampCreated, start),
        lte(predictions.timestampCreated, end)
      ),
    });
    for (const p of preds) {
      if (p.direction === "up") up += 1;
      else if (p.direction === "down") down += 1;
    }
  }

  const slots = [
    {
      slotNumber: 1,
      slotLabel: "Current Period",
      up,
      down,
      total: up + down,
      slotStart: start,
      slotEnd: end,
    },
  ];

  const totalUp = up;
  const totalDown = down;
  const totalPredictions = totalUp + totalDown;
  const upPercentage =
    totalPredictions > 0 ? Math.round((totalUp / totalPredictions) * 100) : 0;
  const downPercentage =
    totalPredictions > 0 ? Math.round((totalDown / totalPredictions) * 100) : 0;

  let overallSentiment: "bullish" | "bearish" | "neutral" = "neutral";
  if (totalPredictions > 0) {
    if (upPercentage > downPercentage) overallSentiment = "bullish";
    else if (downPercentage > upPercentage) overallSentiment = "bearish";
  }

  return {
    duration,
    slots,
    summary: {
      totalPredictions,
      totalUp,
      totalDown,
      upPercentage,
      downPercentage,
      overallSentiment,
    },
    timestamp: new Date().toISOString(),
  };
}

// Admin middleware defined later; keep routes that need it after its declaration.

// ===== Enhanced Slots Endpoints (with new specification) =====
router.get("/slots/:duration/active", async (req, res) => {
  try {
    const duration = req.params.duration as any;
    console.log(`Getting active slot for duration: ${duration}`);

    const activeSlot = await getEnhancedActiveSlot(duration);
    console.log(`Active slot result:`, activeSlot);

    if (!activeSlot) {
      console.log("No active slot found for duration:", duration);
      return res.status(404).json({ error: "No active slot found" });
    }

    return res.json(activeSlot);
  } catch (e) {
    console.error(
      "Error getting active slot for duration",
      req.params.duration,
      ":",
      e
    );
    return res.status(400).json({
      error: "Invalid duration or server error",
      details: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

router.get("/slots/:duration", async (req, res) => {
  try {
    const duration = req.params.duration as any;
    console.log(`Getting all slots for duration: ${duration}`);

    // Use new fixed CEST boundaries
    const { getAllSlotsForDuration, getPartitionedIntervals } = await import(
      "./slot-service"
    );

    const slots = getAllSlotsForDuration(duration);
    console.log(`All slots result for ${duration}:`, slots?.length, "slots");

    // Add partitioned intervals for each slot
    const enhancedSlots = slots.map((slot) => ({
      ...slot,
      intervals: getPartitionedIntervals(duration, slot.start, slot.end),
    }));

    return res.json(enhancedSlots);
  } catch (e) {
    console.error(
      "Error getting slots for duration",
      req.params.duration,
      ":",
      e
    );
    return res.status(400).json({
      error: "Invalid duration or server error",
      details: e instanceof Error ? e.message : "Unknown error",
    });
  }
});

// Get current slot for a duration with lock status
router.get("/slots/:duration/current", async (req, res) => {
  try {
    const duration = req.params.duration as any;
    const {
      getFixedCESTBoundaries,
      getSlotLockStatus,
      getPartitionedIntervals,
    } = await import("./slot-service");

    const currentSlot = getFixedCESTBoundaries(duration);
    const lockStatus = getSlotLockStatus(duration, currentSlot.slotNumber);
    const intervals = getPartitionedIntervals(
      duration,
      currentSlot.start,
      currentSlot.end
    );

    res.json({
      ...currentSlot,
      lockStatus,
      intervals,
    });
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Failed to get current slot",
    });
  }
});

// Validate slot selection endpoint
router.post("/slots/:duration/:slotNumber/validate", async (req, res) => {
  try {
    const duration = req.params.duration as any;
    const slotNumber = parseInt(req.params.slotNumber, 10);

    if (isNaN(slotNumber)) {
      return res.status(400).json({ error: "Invalid slot number" });
    }

    // Import the validation function directly
    const { validateSlotSelection } = await import("./slot-service");
    const validation = validateSlotSelection(duration, slotNumber);
    return res.json(validation);
  } catch (e) {
    console.error("Error validating slot:", e);
    return res.status(400).json({ error: "Invalid duration or server error" });
  }
});

// (Admin slot routes moved below adminMiddleware definition)

// Middleware to parse JSON
router.use(express.json());

// Authentication middleware
const authMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("🔐 Auth middleware called for:", req.path);
    console.log(
      "🔐 Auth middleware - Authorization header:",
      authHeader ? "Present" : "Missing"
    );

    if (!authHeader) {
      console.log("🔐 Auth middleware - No authorization header");
      return res.status(401).json({ error: "Authentication required" });
    }

    let user = null;

    // Try Firebase ID token first
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        // Verify Firebase ID token
        const decodedToken = await getAdminAuth().verifyIdToken(token);

        // Look up the user in the database by email to get the actual UUID
        console.log(
          "Firebase auth - looking up user by email:",
          decodedToken.email
        );
        console.log("Firebase token details:", {
          uid: decodedToken.uid,
          email: decodedToken.email,
          email_verified: decodedToken.email_verified,
        });

        // Try exact match first
        let dbUser = await db.query.users.findFirst({
          where: eq(users.email, decodedToken.email || ""),
        });

        // If not found, try case-insensitive match
        if (!dbUser) {
          console.log("Exact email match failed, trying case-insensitive...");
          const allUsers = await db.query.users.findMany();
          console.log(
            "All users in database:",
            allUsers.map((u) => ({
              id: u.id,
              email: u.email,
              username: u.username,
            }))
          );

          dbUser = allUsers.find(
            (u) => u.email.toLowerCase() === decodedToken.email?.toLowerCase()
          );
        }

        if (!dbUser) {
          console.log(
            "Firebase user not found in database:",
            decodedToken.email
          );
          console.log("Available users:", await db.query.users.findMany());
          return res.status(401).json({ error: "User not found in database" });
        }

        console.log("Firebase auth - found user in database:", {
          firebaseUid: decodedToken.uid,
          dbUserId: dbUser.id,
          email: decodedToken.email,
        });
        // Sync email verification status from Firebase to DB if needed
        try {
          if (decodedToken.email_verified && !dbUser.emailVerified) {
            await db
              .update(users)
              .set({ emailVerified: true })
              .where(eq(users.id, dbUser.id));
            console.log(
              "Synced emailVerified=true to database for user:",
              dbUser.id
            );
            // Refresh dbUser after update
            dbUser = await db.query.users.findFirst({
              where: eq(users.id, dbUser.id),
            });
          }
        } catch (syncErr) {
          console.warn(
            "Failed to sync emailVerified flag from Firebase to DB:",
            syncErr
          );
        }

        user = {
          userId: dbUser.id, // Use the database UUID, not Firebase UID
          email: decodedToken.email || "",
          role: dbUser.role,
        };

        console.log("🔐 Auth middleware - Setting user:", {
          userId: user.userId,
          email: user.email,
          role: user.role,
        });
      } catch (firebaseError) {
        console.error("Firebase token verification failed:", firebaseError);

        // Fallback to JWT verification for database authentication
        try {
          console.log("Trying JWT verification as fallback...");
          user = extractUserFromToken(authHeader);

          if (user) {
            console.log("JWT verification successful:", {
              userId: user.userId,
              email: user.email,
              role: user.role,
            });
          }
        } catch (jwtError) {
          console.log("JWT verification also failed:", jwtError);
          return res
            .status(401)
            .json({ error: "Invalid authentication token" });
        }
      }
    } else {
      return res
        .status(401)
        .json({ error: "Invalid authorization header format" });
    }

    if (!user) {
      console.log("🔐 Auth middleware - No user found");
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log("🔐 Auth middleware - Setting req.user:", {
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication error" });
  }
};

// Optional authentication middleware - doesn't require auth but sets user if available
const optionalAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    console.log("optionalAuthMiddleware: Processing request for:", req.path);
    console.log(
      "optionalAuthMiddleware: Authorization header:",
      req.headers.authorization ? "Present" : "Missing"
    );

    const authHeader = req.headers.authorization;
    let user = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        // Try Firebase ID token first
        const decodedToken = await getAdminAuth().verifyIdToken(token);

        // Look up the user in the database by email to get the actual UUID
        console.log(
          "optionalAuthMiddleware: Firebase auth - looking up user by email:",
          decodedToken.email
        );

        // Try exact match first
        let dbUser = await db.query.users.findFirst({
          where: eq(users.email, decodedToken.email || ""),
        });

        // If not found, try case-insensitive match
        if (!dbUser) {
          console.log(
            "optionalAuthMiddleware: Exact email match failed, trying case-insensitive..."
          );
          const allUsers = await db.query.users.findMany();
          dbUser = allUsers.find(
            (u) => u.email.toLowerCase() === decodedToken.email?.toLowerCase()
          );
        }

        if (dbUser) {
          // Sync email verification status from Firebase to DB if needed (optional auth)
          try {
            if (decodedToken.email_verified && !dbUser.emailVerified) {
              await db
                .update(users)
                .set({ emailVerified: true })
                .where(eq(users.id, dbUser.id));
              console.log(
                "optionalAuthMiddleware: Synced emailVerified=true to DB for user:",
                dbUser.id
              );
              dbUser = await db.query.users.findFirst({
                where: eq(users.id, dbUser.id),
              });
            }
          } catch (syncErr) {
            console.warn(
              "optionalAuthMiddleware: Failed to sync emailVerified flag:",
              syncErr
            );
          }
          user = {
            userId: dbUser.id, // Use the database UUID, not Firebase UID
            email: decodedToken.email || "",
            role: dbUser.role,
          };
          console.log(
            "optionalAuthMiddleware: Firebase auth - found user in database:",
            {
              firebaseUid: decodedToken.uid,
              dbUserId: dbUser.id,
              email: decodedToken.email,
            }
          );
        } else {
          console.log(
            "optionalAuthMiddleware: Firebase user not found in database:",
            decodedToken.email
          );
        }
      } catch (firebaseError) {
        console.log(
          "optionalAuthMiddleware: Firebase token verification failed, trying JWT..."
        );

        // Fallback to JWT verification for database authentication
        try {
          user = extractUserFromToken(authHeader);
          if (user) {
            console.log(
              "optionalAuthMiddleware: JWT verification successful:",
              {
                userId: user.userId,
                email: user.email,
                role: user.role,
              }
            );
          }
        } catch (jwtError) {
          console.log(
            "optionalAuthMiddleware: JWT verification also failed:",
            jwtError
          );
        }
      }
    }

    console.log("optionalAuthMiddleware: Final user:", user);

    if (user) {
      req.user = user;
      console.log("optionalAuthMiddleware: Set req.user:", req.user);
    }

    next();
  } catch (error) {
    console.error("optionalAuthMiddleware: Error:", error);
    next(); // Continue without authentication
  }
};

// Admin middleware
const adminMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  console.log(
    "Admin middleware - Authorization header:",
    req.headers.authorization
  );

  const user = extractUserFromToken(req.headers.authorization);
  console.log("Admin middleware - Extracted user:", user);

  if (!user) {
    console.log("Admin middleware - No user found");
    return res
      .status(403)
      .json({ error: "Admin access required - No user found" });
  }

  if (!isAdmin(user)) {
    console.log("Admin middleware - User is not admin. Role:", user.role);
    return res
      .status(403)
      .json({ error: "Admin access required - User role: " + user.role });
  }

  console.log("Admin middleware - User is admin, proceeding");
  req.user = user;
  next();
};

// Admin Slot Configs CRUD (placed after adminMiddleware)
router.get("/admin/slots", adminMiddleware, async (req, res) => {
  const list = await db.query.slotConfigs.findMany({
    orderBy: [slotConfigs.duration, slotConfigs.slotNumber] as any,
  });
  res.json(list);
});

router.put("/admin/slots/:id", adminMiddleware, async (req, res) => {
  const { startTime, endTime, pointsIfCorrect, penaltyIfWrong } = req.body;
  await db
    .update(slotConfigs)
    .set({ startTime, endTime, pointsIfCorrect, penaltyIfWrong })
    .where(eq(slotConfigs.id, req.params.id as any));
  res.json({ success: true });
});

router.post("/admin/slots", adminMiddleware, async (req, res) => {
  const {
    duration,
    slotNumber,
    startTime,
    endTime,
    pointsIfCorrect,
    penaltyIfWrong,
  } = req.body;
  const [row] = await db
    .insert(slotConfigs)
    .values({
      duration,
      slotNumber,
      startTime,
      endTime,
      pointsIfCorrect,
      penaltyIfWrong,
    })
    .returning();
  res.json(row);
});

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ===== AUTHENTICATION ROUTES =====

// Register
router.post("/auth/register", async (req, res) => {
  try {
    console.log("Registration request received:", req.body);

    // Validate input
    if (!req.body.username || !req.body.email || !req.body.password) {
      console.log("Missing required fields:", {
        username: !!req.body.username,
        email: !!req.body.email,
        password: !!req.body.password,
      });
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

    console.log("Calling registerUser function...");
    const result = await registerUser(req.body);
    console.log("Registration successful:", result);
    // If a referral was applied (new or existing account), broadcast update for referrer
    if ((result as any).appliedRefOwnerId && wsService) {
      try {
        const ownerId = (result as any).appliedRefOwnerId as string;
        const countResult = await db.execute(
          sql`SELECT COUNT(*)::int AS c FROM users WHERE referred_by_user_id = ${ownerId}`
        );
        const referredCount = (countResult.rows?.[0] as any)?.c ?? 0;
        wsService.broadcastReferralUpdate(ownerId, referredCount);
      } catch (e) {
        console.warn(
          "Failed to broadcast referral update after registration:",
          e
        );
      }
    }
    res.json(result);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Registration failed",
    });
  }
});

// Login
router.post("/auth/login", async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.json(result);
  } catch (error) {
    res
      .status(401)
      .json({ error: error instanceof Error ? error.message : "Login failed" });
  }
});

// Verify email
router.post("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    const result = await verifyEmail(token);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Email verification failed",
    });
  }
});

// Verify email via GET (for email links)
router.get("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid verification token" });
    }
    const result = await verifyEmail(token);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Email verification failed",
    });
  }
});

// Resend verification email with cooldown
router.post("/auth/resend-verification", authMiddleware, async (req, res) => {
  try {
    const user = await requireUserWithProfile(req);

    // Check if user is already verified
    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Check cooldown (5 minutes)
    const lastVerification = await db.query.emailVerifications.findFirst({
      where: eq(emailVerifications.userId, user.id),
      orderBy: [desc(emailVerifications.createdAt)],
    });

    if (
      lastVerification &&
      lastVerification.createdAt &&
      Date.now() - lastVerification.createdAt.getTime() < 5 * 60 * 1000
    ) {
      const remainingTime = Math.ceil(
        (5 * 60 * 1000 - (Date.now() - lastVerification.createdAt.getTime())) /
          1000 /
          60
      );
      return res.status(429).json({
        error: `Please wait ${remainingTime} minutes before requesting another verification email`,
        cooldownRemaining: remainingTime * 60 * 1000,
      });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete old verification records
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id));

    // Create new verification record
    await db.insert(emailVerifications).values({
      userId: user.id,
      email: user.email,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken);

    res.json({
      message: "Verification email sent successfully",
      cooldown: 5 * 60 * 1000, // 5 minutes in milliseconds
    });
  } catch (error) {
    console.error("Error resending verification email:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to resend verification email",
    });
  }
});

// Google OAuth login
router.post("/auth/google", async (req, res) => {
  try {
    const { idToken, email, displayName, photoURL } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: "ID token is required" });
    }

    // Verify the Google ID token with Firebase Admin
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (!decodedToken.email) {
      return res.status(400).json({ error: "Email not found in Google token" });
    }

    // Check if user exists
    let existingUser;
    try {
      existingUser = await getUserByEmail(decodedToken.email);
    } catch (error) {
      // User doesn't exist, create one
    }

    let user;
    if (existingUser) {
      // Update existing user with Google info
      user = await db
        .update(users)
        .set({
          emailVerified: true, // Google users are automatically verified
        })
        .where(eq(users.id, existingUser.id))
        .returning()
        .then((rows) => rows[0]);
    } else {
      // Create new user from Google info
      const [newUser] = await db
        .insert(users)
        .values({
          email: decodedToken.email,
          username: displayName || decodedToken.email.split("@")[0],
          password: "", // Google users don't need password
          emailVerified: true, // Google users are automatically verified
        })
        .returning();
      user = newUser;
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Get or create user profile
    let profile;
    try {
      profile = await getUserProfile(user.id);
    } catch (error) {
      // Create profile if it doesn't exist
      const [newProfile] = await db
        .insert(userProfiles)
        .values({
          userId: user.id,
        })
        .returning();
      profile = newProfile;
    }

    res.json({
      user,
      profile,
      token,
      message: "Google login successful",
    });
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Google authentication failed",
    });
  }
});

// Request password reset
router.post("/auth/request-reset", async (req, res) => {
  try {
    const result = await requestPasswordReset(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Password reset request failed",
    });
  }
});

// Reset password
router.post("/auth/reset-password", async (req, res) => {
  try {
    const result = await resetPassword(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Password reset failed",
    });
  }
});

// Resend verification email
router.post("/auth/resend-verification", authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(requireUser(req).userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Delete old verification tokens for this user
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id));

    // Create new verification token
    await db.insert(emailVerifications).values({
      userId: user.id,
      email: user.email,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken);

    res.json({ message: "Verification email sent successfully" });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to resend verification email",
    });
  }
});

// ===== USER ROUTES =====

// Get current user data (including email verification status)
router.get("/user/me", authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(requireUser(req).userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get user data",
    });
  }
});

// Get current user profile
router.get("/user/profile", authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(
      requireUser(req).userId,
      requireUser(req).userId
    );
    res.json(profile);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get profile",
    });
  }
});

// Get user profile by email (for Firebase authentication)
router.get("/user/profile/email/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Find user by email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get full profile
    const profile = await getUserProfile(user.id, user.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get profile",
    });
  }
});

// Update user profile
router.put("/user/profile", authMiddleware, async (req, res) => {
  try {
    const result = await updateUserProfile(requireUser(req).userId, req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Failed to update profile",
    });
  }
});

// Change password
router.post("/user/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    // Get user from database
    const user = await getUserById(requireUser(req).userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Update password in database
    await db
      .update(users)
      .set({ password: hashedNewPassword })
      .where(eq(users.id, requireUser(req).userId));

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to change password",
    });
  }
});

// Change email (triggers re-verification)
router.post("/user/change-email", authMiddleware, async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res
        .status(400)
        .json({ error: "New email and current password are required" });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if new email is already taken
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, newEmail),
    });

    if (existingUser && existingUser.id !== requireUser(req).userId) {
      return res
        .status(400)
        .json({ error: "Email is already taken by another user" });
    }

    // Get user from database
    const user = await getUserById(requireUser(req).userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(
      password,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Update email and reset verification status
    await db
      .update(users)
      .set({
        email: newEmail,
        emailVerified: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Delete old verification records
    await db
      .delete(emailVerifications)
      .where(eq(emailVerifications.userId, user.id));

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new verification record
    await db.insert(emailVerifications).values({
      userId: user.id,
      email: newEmail,
      token: verificationToken,
      expiresAt,
    });

    // Send verification email to new address
    await sendVerificationEmail(newEmail, verificationToken);

    res.json({
      message:
        "Email changed successfully. Please check your new email for verification.",
      emailChanged: true,
    });
  } catch (error) {
    console.error("Email change error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to change email",
    });
  }
});

// Get user profile by username (public - no auth required for basic profile info)
router.get("/user/:username", optionalAuthMiddleware, async (req, res) => {
  try {
    console.log("🚀 GET /user/:username: Processing request:", {
      username: req.params.username,
      viewerId: req.user?.userId,
      hasAuthHeader: !!req.headers.authorization,
    });

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });

    if (!user) {
      console.log("❌ GET /user/:username: User not found");
      return res.status(404).json({ error: "User not found" });
    }

    // Get user profile from database
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, user.id),
    });

    if (!profile) {
      console.log("❌ GET /user/:username: Profile not found");
      return res.status(404).json({ error: "User profile not found" });
    }

    // Check follow status if viewer is authenticated
    let isFollowing = false;
    if (req.user?.userId && req.user.userId !== user.id) {
      const follow = await db.query.userFollows.findFirst({
        where: and(
          eq(userFollows.followerId, req.user.userId),
          eq(userFollows.followingId, user.id)
        ),
      });
      isFollowing = !!follow;
    }

    // Return public profile data with follow status if authenticated
    const publicProfile = {
      id: user.id,
      username: user.username,
      bio: profile.bio,
      avatar: profile.avatar,
      monthlyScore: profile.monthlyScore,
      totalScore: profile.totalScore,
      totalPredictions: profile.totalPredictions,
      correctPredictions: profile.correctPredictions,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      lastMonthRank: profile.lastMonthRank,
      createdAt: user.createdAt,
      isFollowing: isFollowing,
      badges: [], // Empty for now
    };

    console.log("✅ GET /user/:username: Returning public profile:", {
      username: publicProfile.username,
      bio: publicProfile.bio,
      followersCount: publicProfile.followersCount,
      isFollowing: publicProfile.isFollowing,
    });

    res.json(publicProfile);
  } catch (error) {
    console.error("❌ GET /user/:username: Error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get user profile",
    });
  }
});

// Get user profile by username with follow status (requires auth)
router.get("/user/:username/full", optionalAuthMiddleware, async (req, res) => {
  try {
    console.log("🚀 GET /user/:username/full: Processing request:", {
      username: req.params.username,
      viewerId: req.user?.userId,
      userRole: req.user?.role,
      hasAuthHeader: !!req.headers.authorization,
    });

    const profile = await getUserProfileByUsername(
      req.params.username,
      req.user?.userId
    );
    if (!profile) {
      console.log("❌ GET /user/:username/full: User not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ GET /user/:username/full: Returning full profile:", {
      username: profile.username,
      isFollowing: profile.isFollowing,
      followersCount: profile.followersCount,
      viewerId: req.user?.userId,
    });

    res.json(profile);
  } catch (error) {
    console.error("❌ GET /user/:username/full: Error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get user profile",
    });
  }
});

// Get user stats
router.get("/user/:username/stats", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const stats = await getUserStats(user.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get user stats",
    });
  }
});

// ===== FOLLOWING ROUTES =====

// Follow user
router.post("/user/:username/follow", authMiddleware, async (req, res) => {
  try {
    console.log("🚀 POST /user/:username/follow: Processing request:", {
      username: req.params.username,
      followerId: req.user?.userId,
      userRole: req.user?.role,
    });

    const targetUser = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });
    if (!targetUser) {
      console.log("❌ POST /user/:username/follow: Target user not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ POST /user/:username/follow: Target user found:", {
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
    });

    const result = await followUser(requireUser(req).userId, targetUser.id);
    console.log("✅ POST /user/:username/follow: Follow successful:", result);
    res.json(result);
  } catch (error) {
    console.error("❌ POST /user/:username/follow: Error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to follow user",
    });
  }
});

// Unfollow user
router.delete("/user/:username/follow", authMiddleware, async (req, res) => {
  try {
    console.log("🚀 DELETE /user/:username/follow: Processing request:", {
      username: req.params.username,
      followerId: req.user?.userId,
      userRole: req.user?.role,
    });

    const targetUser = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });
    if (!targetUser) {
      console.log("❌ DELETE /user/:username/follow: Target user not found");
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ DELETE /user/:username/follow: Target user found:", {
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
    });

    const result = await unfollowUser(requireUser(req).userId, targetUser.id);
    console.log(
      "✅ DELETE /user/:username/follow: Unfollow successful:",
      result
    );
    res.json(result);
  } catch (error) {
    console.error("❌ DELETE /user/:username/follow: Error:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to unfollow user",
    });
  }
});

// Get following list
router.get("/user/:username/following", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const following = await getFollowing(user.id, 50, 0);
    res.json(following);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get following list",
    });
  }
});

// Get followers list
router.get("/user/:username/followers", async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, req.params.username),
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const followers = await getFollowers(user.id, 50, 0);
    res.json(followers);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get followers list",
    });
  }
});

// ===== PREDICTION ROUTES =====

// Create prediction
router.post("/predictions", authMiddleware, async (req, res) => {
  try {
    console.log("Creating prediction with payload:", {
      userId: requireUser(req).userId,
      body: req.body,
    });

    const result = await createPrediction({
      userId: requireUser(req).userId,
      ...req.body,
    });

    console.log("Prediction created successfully:", result.id);
    res.json(result);
  } catch (error) {
    console.error("Error creating prediction:", error);
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Failed to create prediction",
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Get user predictions
router.get("/predictions", authMiddleware, async (req, res) => {
  try {
    console.log("🔍 Predictions endpoint - req.user:", req.user);
    const userId = requireUser(req).userId;
    console.log(
      "🔍 Predictions endpoint - Getting predictions for user:",
      userId
    );
    console.log(
      "🔍 Predictions endpoint - User ID type check:",
      typeof userId,
      "Length:",
      userId?.length
    );
    console.log(
      "🔍 Predictions endpoint - User ID value:",
      JSON.stringify(userId)
    );

    // Validate that userId is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error("Invalid UUID format for userId:", userId);
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const predictions = await getUserPredictions(userId);
    console.log("Predictions response:", {
      count: predictions.length,
      firstItem: predictions[0],
      userId: userId,
      allPredictions: predictions,
    });
    res.json(predictions);
  } catch (error) {
    console.error("Error getting predictions:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get predictions",
    });
  }
});

// Get user predictions (if following)
router.get(
  "/user/:username/predictions",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      console.log("🔍 GET /user/:username/predictions - Request details:", {
        username: req.params.username,
        viewerId: req.user?.userId,
        viewerRole: req.user?.role,
        hasAuth: !!req.user,
      });

      const user = await db.query.users.findFirst({
        where: eq(users.username, req.params.username),
      });
      if (!user) {
        console.log("❌ User not found:", req.params.username);
        return res.status(404).json({ error: "User not found" });
      }

      console.log("✅ User found:", {
        id: user.id,
        username: user.username,
      });

      // Check if viewer is following this user or is admin
      let canView = false;
      if (req.user?.userId) {
        // Admins can view any user's predictions
        if (req.user.role === "admin") {
          canView = true;
          console.log("✅ Admin access granted");
        } else {
          canView = await isFollowing(req.user.userId, user.id);
          console.log("🔍 Follow check result:", {
            followerId: req.user.userId,
            followingId: user.id,
            canView,
          });
        }
      } else {
        console.log("❌ No authenticated user");
      }

      if (!canView) {
        console.log("❌ Access denied - not following user");
        return res
          .status(403)
          .json({ error: "Must follow user to view predictions" });
      }

      console.log("✅ Access granted, fetching predictions...");
      const predictions = await getUserPredictions(user.id);
      console.log("📊 Predictions fetched:", {
        count: predictions.length,
        sample: predictions[0],
      });

      res.json(predictions);
    } catch (error) {
      console.error("❌ Error in /user/:username/predictions:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to get predictions",
      });
    }
  }
);

// Get user badges (placeholder: return badges from userBadges or empty list)
router.get(
  "/user/:username/badges",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.username, req.params.username),
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // If you have a userBadges table, query it here. Otherwise return empty list.
      // const badges = await db.query.userBadges.findMany({ where: eq(userBadges.userId, user.id) });
      const badges: any[] = [];
      res.json(badges);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get badges",
      });
    }
  }
);

// Get user monthly scores (placeholder: derive from predictions or return empty list)
router.get(
  "/user/:username/scores",
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.username, req.params.username),
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // If you have a monthlyScores table, query it. For now return empty list.
      const scores: any[] = [];
      res.json(scores);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get scores",
      });
    }
  }
);

// Create asset suggestion (public)
router.post("/asset-suggestions", optionalAuthMiddleware, async (req, res) => {
  try {
    const { name, symbol, type, note } = req.body || {};
    if (!name || !symbol || !type) {
      return res
        .status(400)
        .json({ error: "name, symbol and type are required" });
    }
    const [inserted] = await db
      .insert(assetSuggestions)
      .values({
        userId: req.user?.userId || null,
        name,
        symbol,
        type,
        note,
        status: "pending",
      })
      .returning();
    res.json(inserted);
  } catch (error) {
    console.error("Error creating asset suggestion:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to create suggestion",
    });
  }
});

// List asset suggestions (admin)
router.get("/admin/asset-suggestions", adminMiddleware, async (req, res) => {
  try {
    const suggestions = await db.query.assetSuggestions.findMany({
      orderBy: [desc(assetSuggestions.createdAt)],
    });
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to fetch suggestions",
    });
  }
});

// Approve suggestion (admin) -> create asset
router.post(
  "/admin/asset-suggestions/:id/approve",
  adminMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id;
      const suggestion = await db.query.assetSuggestions.findFirst({
        where: eq(assetSuggestions.id, id),
      });
      if (!suggestion)
        return res.status(404).json({ error: "Suggestion not found" });

      // Create asset if not exists
      const existing = await db.query.assets.findFirst({
        where: eq(assetTable.symbol, suggestion.symbol),
      });
      if (!existing) {
        await db.insert(assetTable).values({
          name: suggestion.name,
          symbol: suggestion.symbol,
          type: suggestion.type as any,
          apiSource:
            suggestion.type === "crypto"
              ? "coingecko"
              : suggestion.type === "stock"
              ? "yahoo"
              : "exchangerate",
          isActive: true,
        });
      }

      const [updated] = await db
        .update(assetSuggestions)
        .set({ status: "approved" })
        .where(eq(assetSuggestions.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to approve suggestion",
      });
    }
  }
);

// Reject suggestion (admin)
router.post(
  "/admin/asset-suggestions/:id/reject",
  adminMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id;
      const [updated] = await db
        .update(assetSuggestions)
        .set({ status: "rejected" })
        .where(eq(assetSuggestions.id, id))
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to reject suggestion",
      });
    }
  }
);

// Get user predictions with privacy enforcement
router.get("/users/:userId/predictions", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user?.userId;
    const {
      status,
      assetSymbol,
      duration,
      result,
      page = "1",
      limit = "20",
      startDate,
      endDate,
    } = req.query;

    // Check if viewer is the same user or a follower
    const isOwnProfile = viewerId === userId;
    const isFollower =
      !isOwnProfile && viewerId ? await isFollowing(viewerId, userId) : false;

    if (!isOwnProfile && !isFollower) {
      return res.status(403).json({
        error: "Access denied",
        message:
          "You can only view predictions for your own profile or users you follow",
      });
    }

    // Parse pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 per page
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const whereConditions = [eq(predictions.userId, userId)];

    if (status) {
      whereConditions.push(eq(predictions.status, status as any));
    }

    if (result) {
      whereConditions.push(eq(predictions.result, result as any));
    }

    if (duration) {
      whereConditions.push(eq(predictions.duration, duration as any));
    }

    if (startDate) {
      whereConditions.push(
        gte(predictions.timestampCreated, new Date(startDate as string))
      );
    }

    if (endDate) {
      whereConditions.push(
        lte(predictions.timestampCreated, new Date(endDate as string))
      );
    }

    // Get predictions with asset info
    const userPredictions = await db
      .select({
        id: predictions.id,
        direction: predictions.direction,
        duration: predictions.duration,
        slotNumber: predictions.slotNumber,
        slotStart: predictions.slotStart,
        slotEnd: predictions.slotEnd,
        timestampCreated: predictions.timestampCreated,
        timestampExpiration: predictions.timestampExpiration,
        status: predictions.status,
        result: predictions.result,
        pointsAwarded: predictions.pointsAwarded,
        priceStart: predictions.priceStart,
        priceEnd: predictions.priceEnd,
        evaluatedAt: predictions.evaluatedAt,
        assetId: predictions.assetId,
        assetSymbol: assets.symbol,
        assetName: assets.name,
        assetType: assets.type,
      })
      .from(predictions)
      .innerJoin(assets, eq(predictions.assetId, assets.id))
      .where(and(...whereConditions))
      .orderBy(predictions.timestampCreated)
      .limit(limitNum)
      .offset(offset);

    // Filter by asset symbol if provided
    let filteredPredictions = userPredictions;
    if (assetSymbol) {
      filteredPredictions = userPredictions.filter(
        (pred) => pred.assetSymbol === assetSymbol
      );
    }

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(predictions)
      .where(and(...whereConditions));

    const total = parseInt(totalCount[0]?.count?.toString() || "0");

    res.json({
      predictions: filteredPredictions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user predictions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get sentiment data
router.get("/sentiment/:assetSymbol", async (req, res) => {
  try {
    const { duration = "short" } = req.query;
    const assetSymbol = decodeURIComponent(req.params.assetSymbol);
    console.log(
      `API: Getting sentiment data for ${assetSymbol} with duration ${duration}`
    );
    // Handle global alias here to avoid 500 from asset lookup
    if (assetSymbol.toLowerCase() === "global") {
      const d = (duration as string) || "short";
      const validDurations = ["short", "medium", "long"];
      if (!validDurations.includes(d)) {
        return res
          .status(400)
          .json({ error: "Invalid duration. Must be short, medium, or long" });
      }
      try {
        const response = await computeGlobalSentimentResponse(d);
        return res.json(response);
      } catch (err) {
        console.error(
          "Global sentiment via /sentiment/:assetSymbol handler failed:",
          err
        );
        // Safe fallback
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const luxonSlots = getAllSlotsLuxon(
          oneHourAgo.toISOString(),
          now.toISOString(),
          d as any
        );
        const slots = luxonSlots.map((s) => ({
          slotNumber: s.slotNumber,
          slotLabel: s.slotLabel,
          up: 0,
          down: 0,
          total: 0,
          slotStart: s.slotStart.toJSDate(),
          slotEnd: s.slotEnd.toJSDate(),
        }));
        return res.json({
          duration: d,
          slots,
          summary: {
            totalPredictions: 0,
            totalUp: 0,
            totalDown: 0,
            upPercentage: 0,
            downPercentage: 0,
            overallSentiment: "neutral",
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Log the query parameters
    console.log(`API: Query parameters:`, req.query);
    console.log(`API: Duration parameter:`, duration);

    const sentiment = await getSentimentData(assetSymbol, duration as any);
    console.log(`API: Sentiment data result:`, sentiment);

    // Transform the data to match frontend expectations
    const transformedData = {
      asset: assetSymbol,
      duration: duration,
      slots: sentiment.map((slot) => ({
        slotNumber: slot.slotNumber,
        slotLabel: `Slot ${slot.slotNumber}`,
        up: slot.upCount,
        down: slot.downCount,
        total: slot.totalCount,
      })),
    };

    console.log(`API: Transformed data:`, transformedData);
    res.json(transformedData);
  } catch (error) {
    console.error("API: Error getting sentiment data:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get sentiment data",
    });
  }
});

// ===== GLOBAL TOP ASSETS =====
// GET /api/sentiment/global/top-assets?period=1w|1m|3m
router.get("/sentiment/global/top-assets", async (req, res) => {
  try {
    const period = (req.query.period as string) || "1w";
    const valid = ["1w", "1m", "3m"];
    if (!valid.includes(period))
      return res.status(400).json({ error: "Invalid period" });

    // Use CEST timezone for calendar periods
    const now = new Date();
    const cestNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Berlin" })
    );

    let start: Date;

    if (period === "1w") {
      // Short: Monday → Sunday, CEST timezone
      const dayOfWeek = cestNow.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back to Monday
      start = new Date(cestNow);
      start.setDate(cestNow.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
    } else if (period === "1m") {
      // Medium: 1st day → last day of the month, European calendar, CEST timezone
      start = new Date(cestNow.getFullYear(), cestNow.getMonth(), 1);
    } else if (period === "3m") {
      // Long: quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), CEST timezone
      const quarter = Math.floor(cestNow.getMonth() / 3);
      start = new Date(cestNow.getFullYear(), quarter * 3, 1);
    } else {
      start = new Date(cestNow.getTime() - 7 * 24 * 60 * 60 * 1000); // fallback
    }

    // Use CEST time for end of window as well
    const end = new Date(cestNow);
    if (period === "1w") {
      // End of current week (Sunday 23:59:59 CEST)
      const dayOfWeek = cestNow.getDay();
      const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      end.setDate(cestNow.getDate() + daysToSunday);
      end.setHours(23, 59, 59, 999);
    } else if (period === "1m") {
      // End of current month (last day 23:59:59 CEST)
      end.setMonth(cestNow.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "3m") {
      // End of current quarter (last day of quarter 23:59:59 CEST)
      const quarter = Math.floor(cestNow.getMonth() / 3);
      end.setMonth((quarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
    }

    // Aggregate up/down counts per asset in window
    const rows = await db
      .select({
        assetId: predictions.assetId,
        direction: predictions.direction,
        count: sql<number>`count(*)`,
      })
      .from(predictions)
      .where(
        and(
          gte(predictions.timestampCreated, start),
          lte(predictions.timestampCreated, end)
        )
      )
      .groupBy(predictions.assetId, predictions.direction);

    // Map assetId -> { up, down }
    const map = new Map<string, { up: number; down: number }>();
    for (const r of rows) {
      const m = map.get(r.assetId as unknown as string) || { up: 0, down: 0 };
      if (r.direction === "up") m.up += Number(r.count);
      else m.down += Number(r.count);
      map.set(r.assetId as unknown as string, m);
    }

    // Attach asset info
    const result: Array<{
      assetId: string;
      symbol: string;
      name: string;
      up: number;
      down: number;
      total: number;
      share: number;
    }> = [];
    for (const [assetId, v] of map.entries()) {
      const asset = await db.query.assets.findFirst({
        where: eq(assets.id, assetId as any),
      });
      if (!asset) continue;
      const total = v.up + v.down;
      result.push({
        assetId,
        symbol: asset.symbol,
        name: asset.name,
        up: v.up,
        down: v.down,
        total,
        share: total > 0 ? v.up / total : 0,
      });
    }

    // Rank: Top Up = highest up count; Top Down = highest down count; exclude overlap
    const topUp = [...result]
      .sort((a, b) => b.up - a.up)
      .filter((r) => r.up > 0);
    const used = new Set<string>();
    const topUpLimited = topUp.slice(0, 5).map((r) => {
      used.add(r.assetId);
      return r;
    });
    const topDown = [...result]
      .sort((a, b) => b.down - a.down)
      .filter((r) => r.down > 0 && !used.has(r.assetId))
      .slice(0, 5);

    res.json({ topUp: topUpLimited, topDown });
  } catch (error) {
    console.error("Error fetching top assets:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch top assets", topUp: [], topDown: [] });
  }
});

// Sentiment aggregation endpoint - Enhanced with real-time updates
router.get("/sentiment/:assetSymbol/:duration", async (req, res) => {
  try {
    const { assetSymbol, duration } = req.params;

    // Intercept 'global' keyword to serve global sentiment even if route matches this handler
    if (assetSymbol.toLowerCase() === "global") {
      const response = await computeGlobalSentimentResponse(duration);
      res.json(response);
      if (wsService) {
        wsService.broadcastSentimentUpdate("GLOBAL", duration, response);
      }
      return;
    }
    const token = req.headers.authorization?.replace("Bearer ", "");

    // Check if user is authenticated and verified
    let userId = null;
    if (token) {
      try {
        const decoded = extractUserFromToken(token);
        if (decoded) {
          const user = await getUserById(decoded.userId);
          if (user && user.emailVerified) {
            userId = user.id;
          }
        }
      } catch (error) {
        // Token invalid, continue as unauthenticated
      }
    }

    // Validate duration
    const validDurations = [
      "1h",
      "3h",
      "6h",
      "24h",
      "48h",
      "1w",
      "1m",
      "3m",
      "6m",
      "1y",
    ];
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ error: "Invalid duration" });
    }

    // Get asset
    const asset = await db.query.assets.findFirst({
      where: eq(assets.symbol, assetSymbol),
    });

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Get sentiment data grouped by slot with enhanced aggregation
    const sentimentData = await db
      .select({
        slotNumber: predictions.slotNumber,
        direction: predictions.direction,
        count: sql<number>`count(*)`,
        slotStart: predictions.slotStart,
        slotEnd: predictions.slotEnd,
      })
      .from(predictions)
      .where(
        and(
          eq(predictions.assetId, asset.id),
          eq(predictions.duration, duration as any),
          inArray(predictions.status, ["active", "evaluated"])
        )
      )
      .groupBy(
        predictions.slotNumber,
        predictions.direction,
        predictions.slotStart,
        predictions.slotEnd
      );

    // Process the data to group by slot with enhanced information
    const slotMap = new Map<
      number,
      {
        up: number;
        down: number;
        total: number;
        slotStart: Date;
        slotEnd: Date;
        isActive: boolean;
        timeRemaining?: number;
      }
    >();

    const now = new Date();

    for (const row of sentimentData) {
      const slot = slotMap.get(row.slotNumber) || {
        up: 0,
        down: 0,
        total: 0,
        slotStart: row.slotStart,
        slotEnd: row.slotEnd,
        isActive: false,
        timeRemaining: 0,
      };

      if (row.direction === "up") {
        slot.up = parseInt(row.count.toString());
      } else {
        slot.down = parseInt(row.count.toString());
      }
      slot.total = slot.up + slot.down;

      // Calculate if slot is active and time remaining
      if (now >= slot.slotStart && now <= slot.slotEnd) {
        slot.isActive = true;
        slot.timeRemaining = Math.max(
          0,
          slot.slotEnd.getTime() - now.getTime()
        );
      }

      slotMap.set(row.slotNumber, slot);
    }

    // Convert to array format with enhanced slot information
    const slots = Array.from(slotMap.entries()).map(([slotNumber, data]) => ({
      slotNumber,
      slotLabel: `Slot ${slotNumber}`,
      up: data.up,
      down: data.down,
      total: data.total,
      slotStart: data.slotStart,
      slotEnd: data.slotEnd,
      isActive: data.isActive,
      timeRemaining: data.timeRemaining,
    }));

    // Sort by slot number
    slots.sort((a, b) => a.slotNumber - b.slotNumber);

    // Calculate overall sentiment metrics
    const totalUp = slots.reduce((sum, slot) => sum + slot.up, 0);
    const totalDown = slots.reduce((sum, slot) => sum + slot.down, 0);
    const totalPredictions = totalUp + totalDown;

    const upPercentage =
      totalPredictions > 0 ? Math.round((totalUp / totalPredictions) * 100) : 0;
    const downPercentage =
      totalPredictions > 0
        ? Math.round((totalDown / totalPredictions) * 100)
        : 0;

    // Determine overall sentiment
    let overallSentiment = "neutral";
    if (totalPredictions > 0) {
      if (upPercentage > 60) overallSentiment = "bullish";
      else if (downPercentage > 60) overallSentiment = "bearish";
      else overallSentiment = "neutral";
    }

    const response = {
      asset: assetSymbol,
      duration,
      slots,
      summary: {
        totalPredictions,
        totalUp,
        totalDown,
        upPercentage,
        downPercentage,
        overallSentiment,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);

    // Broadcast sentiment update via WebSocket for real-time updates
    if (wsService) {
      wsService.broadcastSentimentUpdate(assetSymbol, duration, response);
    }
  } catch (error) {
    console.error("Error fetching sentiment data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Global sentiment via query param for compatibility: /api/sentiment/global?duration=short|medium|long
router.get("/sentiment/global", async (req, res) => {
  try {
    const duration = (req.query.duration as string) || "short";
    const validDurations = ["short", "medium", "long"];
    if (!validDurations.includes(duration)) {
      return res
        .status(400)
        .json({ error: "Invalid duration. Must be short, medium, or long" });
    }
    const response = await computeGlobalSentimentResponse(duration);
    res.json(response);
  } catch (error) {
    console.error("Error fetching global sentiment (query):", error);
    // Safe fallback instead of 500
    try {
      const d = (req.query.duration as string) || "short";
      const now = new Date();
      const windowMsMap: Record<string, number> = {
        short: 7 * 24 * 60 * 60 * 1000, // 1 week
        medium: 30 * 24 * 60 * 60 * 1000, // 1 month
        long: 90 * 24 * 60 * 60 * 1000, // 3 months
      };
      const windowMs = windowMsMap[d] || windowMsMap["short"];
      const start = new Date(now.getTime() - windowMs);
      const luxonSlots = getAllSlotsLuxon(
        start.toISOString(),
        now.toISOString(),
        d as any
      );
      const count = Math.max(1, luxonSlots.length);
      const segmentMs = Math.max(1, Math.floor(windowMs / count));
      const slots = Array.from({ length: count }, (_, i) => ({
        slotNumber: i + 1,
        slotLabel: `Slot ${i + 1}`,
        up: 0,
        down: 0,
        total: 0,
        slotStart: new Date(start.getTime() + i * segmentMs),
        slotEnd:
          i === count - 1
            ? now
            : new Date(start.getTime() + (i + 1) * segmentMs),
      }));
      return res.json({
        duration: d,
        slots,
        summary: {
          totalPredictions: 0,
          totalUp: 0,
          totalDown: 0,
          upPercentage: 0,
          downPercentage: 0,
          overallSentiment: "neutral",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (fallbackErr) {
      console.error("Global sentiment fallback (query) failed:", fallbackErr);
      return res.json({
        duration: (req.query.duration as string) || "short",
        slots: Array.from({ length: 8 }, (_, i) => ({
          slotNumber: i + 1,
          slotLabel: `Slot ${i + 1}`,
          up: 0,
          down: 0,
          total: 0,
        })),
        summary: {
          totalPredictions: 0,
          totalUp: 0,
          totalDown: 0,
          upPercentage: 0,
          downPercentage: 0,
          overallSentiment: "neutral",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// Global sentiment aggregation across all assets (no auth required)
router.get("/sentiment/global/:duration", async (req, res) => {
  try {
    const { duration } = req.params;

    // Validate duration
    const validDurations = ["short", "medium", "long"];
    if (!validDurations.includes(duration)) {
      return res
        .status(400)
        .json({ error: "Invalid duration. Must be short, medium, or long" });
    }

    const response = await computeGlobalSentimentResponse(duration);

    res.json(response);

    if (wsService) {
      wsService.broadcastSentimentUpdate("GLOBAL", duration, response);
    }
  } catch (error) {
    console.error("Error fetching global sentiment data:", error);
    // Return safe fallback instead of 500
    try {
      const d = (req.params.duration as string) || "24h";
      const now = new Date();
      const windowMsMap: Record<string, number> = {
        "1h": 60 * 60 * 1000,
        "3h": 3 * 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "48h": 48 * 60 * 60 * 1000,
        "1w": 7 * 24 * 60 * 60 * 1000,
        "1m": 30 * 24 * 60 * 60 * 1000,
        "3m": 90 * 24 * 60 * 60 * 1000,
        "6m": 180 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
      };
      const windowMs = windowMsMap[d] || windowMsMap["24h"];
      const start = new Date(now.getTime() - windowMs);
      const luxonSlots = getAllSlotsLuxon(
        start.toISOString(),
        now.toISOString(),
        d as any
      );
      const count = Math.max(1, luxonSlots.length);
      const segmentMs = Math.max(1, Math.floor(windowMs / count));
      const slots = Array.from({ length: count }, (_, i) => ({
        slotNumber: i + 1,
        slotLabel: `Slot ${i + 1}`,
        up: 0,
        down: 0,
        total: 0,
        slotStart: new Date(start.getTime() + i * segmentMs),
        slotEnd:
          i === count - 1
            ? now
            : new Date(start.getTime() + (i + 1) * segmentMs),
      }));
      return res.json({
        duration: d,
        slots,
        summary: {
          totalPredictions: 0,
          totalUp: 0,
          totalDown: 0,
          upPercentage: 0,
          downPercentage: 0,
          overallSentiment: "neutral",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (fallbackErr) {
      console.error("Global sentiment fallback failed:", fallbackErr);
      return res.json({
        duration: (req.params.duration as string) || "24h",
        slots: Array.from({ length: 8 }, (_, i) => ({
          slotNumber: i + 1,
          slotLabel: `Slot ${i + 1}`,
          up: 0,
          down: 0,
          total: 0,
        })),
        summary: {
          totalPredictions: 0,
          totalUp: 0,
          totalDown: 0,
          upPercentage: 0,
          downPercentage: 0,
          overallSentiment: "neutral",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// ===== SLOT ROUTES =====

// Get active slot
router.get("/slots/:duration/active", async (req, res) => {
  try {
    const duration = req.params.duration as "short" | "medium" | "long";
    if (!["short", "medium", "long"].includes(duration)) {
      return res
        .status(400)
        .json({ error: "Invalid duration. Must be short, medium, or long" });
    }
    const slot = await getActiveSlot(duration);
    res.json(slot);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get active slot",
    });
  }
});

// Get all slots for duration
router.get("/slots/:duration", async (req, res) => {
  try {
    const duration = req.params.duration as "short" | "medium" | "long";
    if (!["short", "medium", "long"].includes(duration)) {
      return res
        .status(400)
        .json({ error: "Invalid duration. Must be short, medium, or long" });
    }
    const slots = await getAllSlots(duration);
    res.json(slots);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get slots",
    });
  }
});

// Get next slot
router.get("/slots/:duration/next", async (req, res) => {
  try {
    const slot = await getNextSlot(req.params.duration as any);
    res.json(slot);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get next slot",
    });
  }
});

// ===== ASSET ROUTES =====

// Test direct PostgreSQL connection
router.get("/test-pg", async (req, res) => {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:erXKZIzQTMZHWCHbbgLHnAzYDljXdrIe@hopper.proxy.rlwy.net:26012/railway";
  console.log("Using connection string:", connectionString ? "Set" : "Not set");

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log("Testing direct PostgreSQL connection...");
    await client.connect();
    console.log("Direct PostgreSQL connection successful");

    const result = await client.query("SELECT 1 as test");
    console.log("Direct query successful:", result.rows);

    await client.end();
    res.json({
      success: true,
      message: "Direct PostgreSQL connection works",
      result: result.rows,
    });
  } catch (error) {
    console.error("Direct PostgreSQL test failed:", error);
    try {
      await client.end();
    } catch {}
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Direct PostgreSQL test failed",
      code: (error as any).code,
      errno: (error as any).errno,
    });
  }
});

// Test database connection
router.get("/test-db", async (req, res) => {
  try {
    console.log("Testing database connection...");
    console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
    console.log("NODE_ENV:", process.env.NODE_ENV);

    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("Database test successful:", result);
    res.json({ success: true, message: "Database connection works", result });
  } catch (error) {
    console.error("Database test failed:", error);
    console.error(
      "Full error object:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Database test failed",
      stack: error instanceof Error ? error.stack : undefined,
      code: (error as any).code,
      errno: (error as any).errno,
      syscall: (error as any).syscall,
      address: (error as any).address,
      port: (error as any).port,
    });
  }
});

// Test different tables
router.get("/test-users", async (req, res) => {
  try {
    console.log("Test users endpoint hit");
    const result = await db.select().from(users).limit(3);
    console.log("Users query completed, count:", result.length);
    res.json({
      users: result.map((u) => ({ id: u.id, username: u.username })),
      count: result.length,
    });
  } catch (error) {
    console.error("Users test error:", error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

// Simple assets endpoint for testing
// ===== COIN CATALOG ROUTES (Optimized Search) =====

// Hybrid search: Coin catalog (crypto) + Assets table (stocks/forex) - NO PRICE CALLS
router.get("/catalog/search", async (req, res) => {
  try {
    const { q, limit = "50" } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const { searchCoinCatalog, enrichCatalogOnDemand } = await import(
      "./coin-catalog-service"
    );
    const searchQuery = q.trim().toLowerCase();

    // 1. Search coin catalog (crypto only) - NO PRICE CALLS
    let catalogResults = await searchCoinCatalog(q, parseInt(limit as string));

    // 2. Search assets table (stocks & forex) - NO PRICE CALLS
    const assetsResults = await db
      .select({
        id: assets.id,
        coinId: assets.symbol, // Map to coinId for consistency
        symbol: assets.symbol,
        name: assets.name,
        slug: assets.symbol,
        marketCapRank: sql<number>`NULL`,
        isActive: assets.isActive,
        logoUrl: sql<string>`NULL`,
        type: assets.type,
      })
      .from(assets)
      .where(
        sql`(LOWER(${assets.symbol}) LIKE ${`%${searchQuery}%`} OR LOWER(${
          assets.name
        }) LIKE ${`%${searchQuery}%`})`
      )
      .limit(25);

    // 3. Combine results - crypto first, then stocks/forex
    // Standardize coinId to use symbol for both crypto and stocks/forex
    const combinedResults = [
      ...catalogResults.map((coin) => ({
        ...coin,
        coinId: coin.symbol, // Use ticker symbol as coinId for consistency
        source: "catalog",
      })),
      ...assetsResults.map((asset) => ({ ...asset, source: "assets" })),
    ];

    // Debug: Log what we're returning for stocks and crypto
    if (
      q.toLowerCase().includes("aapl") ||
      q.toLowerCase().includes("apple") ||
      q.toLowerCase().includes("btc") ||
      q.toLowerCase().includes("bitcoin") ||
      q.toLowerCase().includes("aaplx")
    ) {
      console.log(`[SEARCH DEBUG] Query: "${q}"`);
      console.log(
        `[SEARCH DEBUG] Catalog results:`,
        catalogResults.map((c) => ({
          coinId: c.coinId,
          symbol: c.symbol,
          name: c.name,
        }))
      );
      console.log(
        `[SEARCH DEBUG] Assets results:`,
        assetsResults.map((a) => ({
          coinId: a.coinId,
          symbol: a.symbol,
          name: a.name,
        }))
      );
      console.log(
        `[SEARCH DEBUG] Combined results (standardized):`,
        combinedResults.map((r) => ({
          coinId: r.coinId,
          symbol: r.symbol,
          name: r.name,
          source: r.source,
        }))
      );
    }

    // 4. If no results, try on-demand enrichment for crypto
    if (combinedResults.length === 0) {
      console.log(`No results for "${q}", attempting on-demand enrichment...`);
      const enrichedCoin = await enrichCatalogOnDemand(q);
      if (enrichedCoin) {
        // Standardize the enriched coin too
        combinedResults.push({
          ...enrichedCoin,
          coinId: enrichedCoin.symbol, // Use ticker symbol as coinId for consistency
          source: "catalog",
        });
      }
    }

    console.log(
      `[HYBRID SEARCH] Query: "${q}" - Catalog: ${catalogResults.length}, Assets: ${assetsResults.length}, Total: ${combinedResults.length}`
    );

    res.json({
      query: q,
      results: combinedResults.slice(0, parseInt(limit as string)),
      count: combinedResults.length,
      breakdown: {
        crypto: catalogResults.length,
        stocksForex: assetsResults.length,
      },
      priceCallsMade: 0, // Monitoring: confirm zero price calls during search
    });
  } catch (error) {
    console.error("Error searching catalog:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Search failed",
    });
  }
});

// Get single coin from catalog by coinId
router.get("/catalog/coin/:coinId", async (req, res) => {
  try {
    const { coinId } = req.params;
    const { getCoinFromCatalog } = await import("./coin-catalog-service");

    const coin = await getCoinFromCatalog(coinId);

    if (!coin) {
      return res.status(404).json({ error: "Coin not found in catalog" });
    }

    res.json(coin);
  } catch (error) {
    console.error("Error fetching coin from catalog:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch coin",
    });
  }
});

// Fetch live price for specific coin/asset (ONLY after user selection)
// Handles crypto, stocks, and forex with appropriate external APIs
router.get("/catalog/price/:coinId", async (req, res) => {
  try {
    let { coinId } = req.params;

    // Handle double or malformed encodings safely
    try {
      coinId = decodeURIComponent(coinId);
      if (coinId.includes("%")) coinId = decodeURIComponent(coinId); // double decode if needed
    } catch {
      console.warn(`⚠️ Could not decode ${req.params.coinId}`);
    }

    const decodedCoinId = coinId;
    console.log(
      `[PRICE REQUEST] Fetching price for: ${req.params.coinId} (decoded: ${decodedCoinId})`
    );

    console.log(
      `[PRICE REQUEST] Fetching price for: ${coinId} (decoded: ${decodedCoinId})`
    );

    // Handle special Binance symbols (e.g., BINANCE:ETHBEARUSDT, BINANCE:BCDBTC)
    if (decodedCoinId.startsWith("BINANCE:")) {
      console.log(`[PRICE REQUEST] Binance symbol detected: ${decodedCoinId}`);

      // Extract base currency from Binance trading pair
      const tradingPair = decodedCoinId.replace("BINANCE:", "");
      const quoteCurrencies = [
        "USDT",
        "USDC",
        "BTC",
        "ETH",
        "BNB",
        "FDUSD",
        "TRY",
        "BUSD",
        "DAI",
      ];
      let baseSymbol = tradingPair;

      // Try to extract base currency by removing common quote currencies
      for (const quote of quoteCurrencies) {
        if (tradingPair.endsWith(quote)) {
          baseSymbol = tradingPair.slice(0, -quote.length);
          break;
        }
      }

      console.log(
        `[PRICE REQUEST] Extracted base currency: ${baseSymbol} from ${tradingPair}`
      );

      // Use CoinGecko to get price for the base currency
      const { fetchLivePriceForCoin } = await import("./coin-catalog-service");

      // Map common symbols to CoinGecko IDs
      const symbolToCoinGeckoId: Record<string, string> = {
        BTC: "bitcoin",
        ETH: "ethereum",
        ADA: "cardano",
        SOL: "solana",
        DOT: "polkadot",
        BCD: "bitcoin-diamond", // BCD/BTC -> BCD
        FIO: "fio-protocol", // FIO/BTC -> FIO
      };

      const coinGeckoId =
        symbolToCoinGeckoId[baseSymbol.toUpperCase()] ||
        baseSymbol.toLowerCase();
      const priceData = await fetchLivePriceForCoin(coinGeckoId);

      if (!priceData) {
        console.error(
          `❌ Failed to fetch Binance price for ${decodedCoinId} (base: ${baseSymbol}, CoinGecko ID: ${coinGeckoId})`
        );
        return res.status(404).json({
          error: "Price not available",
          assetType: "crypto",
          symbol: decodedCoinId,
          message: `Unable to fetch Binance price for ${baseSymbol}. The trading pair may be delisted or API may be unavailable.`,
        });
      }

      console.log(
        `✅ [EXTERNAL API] Fresh Binance price for ${decodedCoinId} (${baseSymbol}): $${priceData.price}`
      );

      return res.json({
        coinId: decodedCoinId,
        ...priceData,
        assetType: "crypto",
        priceCallsMade: 1,
      });
    }

    // First, check if it's in coin catalog (crypto) by symbol
    const { getCoinFromCatalogBySymbol, fetchLivePriceForCoin } = await import(
      "./coin-catalog-service"
    );
    const catalogCoin = await getCoinFromCatalogBySymbol(decodedCoinId);

    if (catalogCoin) {
      // It's a crypto - use CoinGecko with the CoinGecko ID
      console.log(
        `[PRICE REQUEST] Found in catalog as crypto: ${decodedCoinId} (CoinGecko ID: ${catalogCoin.coinId})`
      );
      const priceData = await fetchLivePriceForCoin(catalogCoin.coinId);

      if (!priceData) {
        return res.status(404).json({ error: "Price not available" });
      }

      return res.json({
        coinId: decodedCoinId,
        ...priceData,
        assetType: "crypto",
        priceCallsMade: 1,
      });
    }

    // Not in catalog, check assets table (stocks/forex/crypto)
    let asset = await db.query.assets.findFirst({
      where: eq(assets.symbol, decodedCoinId),
    });

    // If not found in assets table, try on-demand enrichment (for coins like AAPLX)
    if (!asset) {
      console.log(
        `[PRICE REQUEST] Asset not found in assets table, trying on-demand enrichment for: ${decodedCoinId}`
      );
      const { enrichCatalogOnDemand } = await import("./coin-catalog-service");
      const enrichedCoin = await enrichCatalogOnDemand(decodedCoinId);
    }

    if (!asset) {
      console.log(
        `[PRICE REQUEST] Asset not found in catalog, assets table, or on-demand enrichment: ${decodedCoinId}`
      );
      return res.status(404).json({ error: "Asset not found" });
    }

    console.log(
      `[PRICE REQUEST] Found in assets as ${asset.type}: ${decodedCoinId}`
    );

    // Handle crypto assets from assets table using CoinGecko
    if (asset.type === "crypto") {
      console.log(
        `💰 [EXTERNAL API CALL] Fetching FRESH crypto price from CoinGecko for: ${decodedCoinId}`
      );
      const { fetchLivePriceForCoin } = await import("./coin-catalog-service");

      // Map common crypto symbols to CoinGecko IDs
      const symbolToCoinGeckoId: Record<string, string> = {
        BTC: "bitcoin",
        ETH: "ethereum",
        ADA: "cardano",
        SOL: "solana",
        DOT: "polkadot",
      };

      const coinGeckoId =
        symbolToCoinGeckoId[decodedCoinId.toUpperCase()] ||
        decodedCoinId.toLowerCase();
      const priceData = await fetchLivePriceForCoin(coinGeckoId);

      if (!priceData) {
        console.error(
          `❌ Failed to fetch crypto price for ${decodedCoinId} (CoinGecko ID: ${coinGeckoId})`
        );
        return res.status(404).json({
          error: "Price not available",
          assetType: "crypto",
          symbol: decodedCoinId,
          message: `Unable to fetch crypto price from CoinGecko API. The asset may be delisted or API may be unavailable.`,
        });
      }

      console.log(
        `✅ [EXTERNAL API] Fresh crypto price for ${decodedCoinId}: $${priceData.price}`
      );

      return res.json({
        coinId: decodedCoinId,
        ...priceData,
        assetType: "crypto",
        priceCallsMade: 1,
      });
    }

    // Handle stocks/forex from assets table
    console.log(
      `💰 [EXTERNAL API CALL] Fetching FRESH price for ${asset.type}: ${decodedCoinId}`
    );

    // Fetch price based on asset type using external APIs
    const { getLiveAssetPrice } = await import("./price-service");
    const price = await getLiveAssetPrice(decodedCoinId);

    console.log(
      `[PRICE REQUEST] Result for ${decodedCoinId}: ${
        price !== null ? `$${price}` : "null (failed)"
      }`
    );

    if (price === null || price <= 0) {
      console.error(
        `❌ Failed to fetch ${asset.type} price for ${decodedCoinId}`
      );
      return res.status(404).json({
        error: "Price not available",
        assetType: asset.type,
        symbol: decodedCoinId,
        message: `Unable to fetch ${asset.type} price from external API. The asset may be delisted or API may be unavailable.`,
      });
    }

    console.log(
      `✅ [EXTERNAL API] Fresh ${asset.type} price for ${decodedCoinId}: $${price}`
    );

    res.json({
      coinId: decodedCoinId,
      price,
      change24h: 0, // Stock/forex APIs may not provide this
      marketCap: 0,
      timestamp: new Date(),
      assetType: asset.type,
      priceCallsMade: 1, // Monitoring: exactly one price call per selection
    });
  } catch (error) {
    console.error("Error fetching price:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch price",
    });
  }
});

// Batch fetch prices for multiple coins
router.post("/catalog/prices/batch", async (req, res) => {
  try {
    const { coinIds } = req.body;

    if (!Array.isArray(coinIds) || coinIds.length === 0) {
      return res.status(400).json({ error: "coinIds array is required" });
    }

    const { fetchBatchPrices } = await import("./coin-catalog-service");
    const prices = await fetchBatchPrices(coinIds);

    res.json({
      prices,
      count: Object.keys(prices).length,
      priceCallsMade: 1, // One batch call for multiple coins
    });
  } catch (error) {
    console.error("Error fetching batch prices:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch prices",
    });
  }
});

// Manually trigger catalog update (admin only)
router.post("/catalog/update", authMiddleware, async (req, res) => {
  try {
    const user = requireUser(req);

    // Check if user is admin
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, user.userId),
    });

    if (!userRecord || userRecord.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { populateCoinCatalog } = await import("./coin-catalog-service");
    const result = await populateCoinCatalog(250);

    res.json(result);
  } catch (error) {
    console.error("Error updating catalog:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Catalog update failed",
    });
  }
});

router.get("/assets-simple", async (req, res) => {
  try {
    console.log("Simple assets endpoint hit");
    const result = await db.select().from(assets).limit(5);
    console.log("Simple query completed, count:", result.length);
    res.json({ assets: result, count: result.length });
  } catch (error) {
    console.error("Simple assets error:", error);
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

// Get all assets with pagination
router.get("/assets", async (req, res) => {
  try {
    console.log("Assets endpoint hit:", req.query);
    const { type, page = "1", limit = "30" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    console.log("Query params:", { type, pageNum, limitNum, offset });

    let whereClause = undefined;
    if (type) {
      whereClause = eq(assets.type, type as "crypto" | "stock" | "forex");
      console.log("Using type filter:", type);
    }

    console.log("Starting assets query...");

    // Add timeout wrapper
    const queryTimeout = 60000; // 10 seconds
    const assetsPromise = db.query.assets.findMany({
      where: whereClause,
      orderBy: [assets.symbol],
      limit: limitNum,
      offset: offset,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), queryTimeout)
    );

    const assetsList = (await Promise.race([
      assetsPromise,
      timeoutPromise,
    ])) as any[];
    console.log("Assets query completed, count:", assetsList.length);

    // Get total count for pagination info with timeout
    console.log("Starting count query...");
    const countPromise = db
      .select({ count: sql`count(*)` })
      .from(assets)
      .where(whereClause);
    const totalCount = (await Promise.race([
      countPromise,
      timeoutPromise,
    ])) as any[];
    const total = parseInt(totalCount[0].count.toString());
    console.log("Count query completed, total:", total);

    const response = {
      assets: assetsList,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      },
    };

    console.log("Sending response with", assetsList.length, "assets");
    res.json(response);
  } catch (error) {
    console.error("Assets endpoint error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get assets";
    console.error("Error details:", errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Get live asset price (real-time from APIs) - MUST come before general price route
// Handle symbols with colons by using query parameter
router.get("/assets/live-price", async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    if (!symbol) {
      return res.status(400).json({ error: "Symbol parameter is required" });
    }

    console.log("Live price route - symbol:", symbol);
    const { getLiveAssetPrice } = await import("./price-service");

    const price = await getLiveAssetPrice(symbol);
    if (price === null) {
      return res
        .status(404)
        .json({ error: "Asset not found or price unavailable" });
    }

    res.json({
      symbol,
      price,
      timestamp: new Date().toISOString(),
      source: "live",
    });
  } catch (error) {
    console.error(`Error fetching live price for ${req.query.symbol}:`, error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get live asset price",
    });
  }
});

// Fallback route for symbols without colons
router.get("/assets/:symbol/live-price", async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    console.log("Parameterized route - symbol:", symbol);
    const { getLiveAssetPrice } = await import("./price-service");

    const price = await getLiveAssetPrice(symbol);
    if (price === null) {
      return res
        .status(404)
        .json({ error: "Asset not found or price unavailable" });
    }

    res.json({
      symbol,
      price,
      timestamp: new Date().toISOString(),
      source: "live",
    });
  } catch (error) {
    console.error(`Error fetching live price for ${req.params.symbol}:`, error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get live asset price",
    });
  }
});

// Get asset price (cached from database)
// Wildcard version to handle symbols with slashes/colons
router.get("/assets/*/price", async (req, res, next) => {
  try {
    const symbolRaw = req.params[0];
    const symbol = decodeURIComponent(symbolRaw);
    const price = await getAssetPrice(symbol);
    if (!price) return res.status(404).json({ error: "Price not found" });
    res.json({ symbol, price });
  } catch (err) {
    next(err);
  }
});
router.get("/assets/:symbol(*)/price", async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const price = await getAssetPrice(symbol);
    if (!price) {
      return res.status(404).json({ error: "Price not found" });
    }
    res.json({ symbol, price });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get asset price",
    });
  }
});

// Get asset price history
// Wildcard version to handle symbols with slashes/colons
router.get("/assets/*/history", async (req, res, next) => {
  try {
    const symbolRaw = req.params[0];
    const symbol = decodeURIComponent(symbolRaw);
    const { days = 30 } = req.query;
    const history = await getAssetPriceHistory(symbol, Number(days));
    res.json(history);
  } catch (err) {
    next(err);
  }
});
router.get("/assets/:symbol(*)/history", async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const { days = 30 } = req.query;
    const history = await getAssetPriceHistory(symbol, Number(days));
    res.json(history);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get price history",
    });
  }
});

// Debug route to catch all asset requests (removed as it was causing 404 errors)

// ===== OPINION ROUTES =====

// Get opinions for an asset
router.get("/assets/:symbol(*)/opinions", async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const { page = 1, limit = 10 } = req.query;

    // For now, return empty array until opinion service is implemented
    res.json({
      opinions: [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get opinions",
    });
  }
});

// Get asset by symbol (general route - must come after all specific routes)
// Wildcard version to handle symbols with slashes/colons
router.get("/assets/*", async (req, res, next) => {
  try {
    const symbol = decodeURIComponent(req.params[0]);
    console.log(`API: Asset route hit with wildcard symbol: ${symbol}`);
    const asset = await getAssetBySymbol(symbol);
    if (!asset) return res.status(404).json({ error: "Asset not found" });
    res.json(asset);
  } catch (err) {
    next(err);
  }
});

// Test route
router.get("/test-analyst", (req, res) => {
  res.json({ message: "Test route working" });
});

// Test route with same pattern as analyst consensus
router.get("/assets/:symbol(*)/test-pattern", (req, res) => {
  res.json({ message: "Pattern test working", symbol: req.params.symbol });
});

// Simple test route
router.get("/test-simple", (req, res) => {
  res.json({ message: "Simple test working - UPDATED VERSION" });
});

// Test assets limit
router.get("/test-assets-limit", async (req, res) => {
  try {
    const { limit = "999999" } = req.query;
    const limitNum = parseInt(limit as string);
    console.log("Test assets limit - requested limit:", limitNum);

    const result = await db.select().from(assets).limit(limitNum);
    console.log("Test assets limit - actual returned:", result.length);

    res.json({
      message: "Assets limit test",
      requestedLimit: limitNum,
      actualReturned: result.length,
      totalInDb: result.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : "Test failed" });
  }
});

// Test endpoint to get all user details
router.get("/test-user-details", async (req, res) => {
  try {
    console.log("Testing user details query...");
    const allUsers = await db.query.users.findMany();
    console.log(`Found ${allUsers.length} users`);
    res.json({
      message: "User details query successful",
      count: allUsers.length,
      users: allUsers.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("User details query error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "User details query failed",
    });
  }
});

// Get analyst consensus and price targets for an asset
router.get("/analyst-consensus/:symbol(*)", async (req, res) => {
  try {
    console.log("=== ANALYST CONSENSUS REQUEST ===");
    const symbol = decodeURIComponent(req.params.symbol);
    const duration = (req.query.duration as string) || "short";
    console.log("Decoded symbol:", symbol, "Duration:", duration);

    // Find the asset
    const asset = await getAssetBySymbol(symbol);
    if (!asset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Get current price
    const currentPrice = await getCurrentPrice(asset.id);
    const priceToUse = currentPrice || 50000; // Default fallback

    // Fetch predictions filtered by duration
    const predictionsResult = await db.execute(sql`
      SELECT direction, created_at, user_id, asset_id, duration
      FROM predictions 
      WHERE asset_id = ${asset.id} 
      AND duration = ${duration}
      AND status IN ('active', 'evaluated')
      ORDER BY created_at DESC
    `);

    const assetPredictions = predictionsResult.rows || [];
    console.log(
      `Found ${assetPredictions.length} predictions for ${symbol} in ${duration} duration`
    );

    // === Calculate consensus ===
    const totalPredictions = assetPredictions.length;
    let buyCount = 0;
    let sellCount = 0;
    let holdCount = 0;

    assetPredictions.forEach((p: any) => {
      if (p.direction === "up") buyCount++;
      else if (p.direction === "down") sellCount++;
      else holdCount++;
    });

    const buyPercentage =
      totalPredictions > 0
        ? Math.round((buyCount / totalPredictions) * 100)
        : 0;
    const sellPercentage =
      totalPredictions > 0
        ? Math.round((sellCount / totalPredictions) * 100)
        : 0;
    const holdPercentage =
      totalPredictions > 0
        ? Math.round((holdCount / totalPredictions) * 100)
        : 0;

    // Recommendation
    let recommendation = "Hold";
    if (buyPercentage > sellPercentage && buyPercentage > holdPercentage) {
      recommendation = "Buy";
    } else if (
      sellPercentage > buyPercentage &&
      sellPercentage > holdPercentage
    ) {
      recommendation = "Sell";
    }

    // === Price data generation ===
    const averagePriceTarget = priceToUse;

    // Sentiment-based short-term trend (-10% to +10%)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentPredictions = assetPredictions.filter(
      (p: any) => new Date(p.created_at) > sevenDaysAgo
    );

    const recentBuyRatio =
      recentPredictions.length > 0
        ? recentPredictions.filter((p: any) => p.direction === "up").length /
          recentPredictions.length
        : 0.5;

    const priceChange = Math.round((recentBuyRatio - 0.5) * 20 * 100) / 100; // -10% to +10%

    const lowEstimate = Math.round(averagePriceTarget * 0.8);
    const highEstimate = Math.round(averagePriceTarget * 1.2);

    // === Generate high-resolution historical + projected price data ===
    const priceHistory = [];
    const priceProjections = [];
    const currentTime = new Date();

    // --- Historical (past 12 months) - every 15 days ---
    for (let i = 365; i >= 0; i -= 15) {
      const date = new Date(currentTime);
      date.setDate(date.getDate() - i);

      const volatility = 0.12; // 12% variation
      const basePrice =
        priceToUse * (1 - volatility / 2 + Math.random() * volatility);

      priceHistory.push({
        date: date.toISOString().split("T")[0],
        price: Math.round(basePrice * 100) / 100,
      });
    }

    // --- Projections (next 12 months) - every 15 days ---
    for (let i = 15; i <= 365; i += 15) {
      const date = new Date(currentTime);
      date.setDate(date.getDate() + i);

      const basePrice = averagePriceTarget;
      const volatility = 0.1; // 10% variation
      const trend = priceChange / 100; // derived from sentiment

      const projection =
        basePrice *
        (1 + trend * (i / 365)) *
        (1 - volatility / 2 + Math.random() * volatility);

      priceProjections.push({
        date: date.toISOString().split("T")[0],
        price: Math.round(projection * 100) / 100,
      });
    }

    // === Response ===
    const response = {
      buy: buyCount,
      hold: holdCount,
      sell: sellCount,
      buyPercentage,
      holdPercentage,
      sellPercentage,
      total: totalPredictions,
      averagePrice: averagePriceTarget,
      priceChange,
      lowEstimate,
      highEstimate,
      analystCount: totalPredictions,
      recommendation,
      priceHistory,
      priceProjections,
    };

    console.log("Analyst consensus response:", response);
    res.json(response);
  } catch (error) {
    console.error("Error in analyst consensus:", error);
    res.status(500).json({
      error: "Failed to fetch analyst consensus",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/assets/:symbol(*)", async (req, res) => {
  try {
    console.log(`API: Asset route hit with params:`, req.params);
    // Handle double URL encoding issue
    const symbol = decodeURIComponent(req.params.symbol);
    console.log(`API: Looking for asset with symbol: ${symbol}`);

    // Debug: Log all available assets if symbol contains special characters
    if (
      symbol.includes(":") ||
      symbol.includes("%") ||
      symbol.toLowerCase().includes("binance")
    ) {
      console.log(`[ASSET DEBUG] Requested symbol: "${symbol}"`);
      const allAssets = await db.query.assets.findMany();
      console.log(
        `[ASSET DEBUG] Available assets:`,
        allAssets.map((a) => ({ symbol: a.symbol, name: a.name, type: a.type }))
      );
    }

    // Handle special Binance symbols
    if (symbol.startsWith("BINANCE:")) {
      console.log(`API: Binance symbol detected: ${symbol}`);
      const tradingPair = symbol.replace("BINANCE:", "");
      const quoteCurrencies = [
        "USDT",
        "USDC",
        "BTC",
        "ETH",
        "BNB",
        "FDUSD",
        "TRY",
        "BUSD",
        "DAI",
      ];
      let baseSymbol = tradingPair;

      // Extract base currency
      for (const quote of quoteCurrencies) {
        if (tradingPair.endsWith(quote)) {
          baseSymbol = tradingPair.slice(0, -quote.length);
          break;
        }
      }

      // Create a virtual asset for Binance trading pairs
      const asset = {
        id: `binance-${symbol.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        symbol: symbol,
        name: `Binance ${baseSymbol}/${tradingPair.replace(baseSymbol, "")}`,
        type: "crypto" as const,
        apiSource: "coingecko" as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log(`API: Created virtual Binance asset:`, {
        symbol: asset.symbol,
        name: asset.name,
        type: asset.type,
      });
      return res.json(asset);
    }

    // First try the assets table (stocks/forex)
    let asset = await getAssetBySymbol(symbol);

    // If not found in assets table, try coin catalog (crypto)
    if (!asset) {
      console.log(
        `API: Asset not found in assets table, checking coin catalog for: ${symbol}`
      );
      const { getCoinFromCatalogBySymbol } = await import(
        "./coin-catalog-service"
      );
      const catalogCoin = await getCoinFromCatalogBySymbol(symbol);

      if (catalogCoin) {
        // Convert catalog coin to asset format
        asset = {
          id: catalogCoin.id,
          symbol: catalogCoin.symbol,
          name: catalogCoin.name,
          type: "crypto" as const,
          apiSource: "coingecko" as const,
          isActive: catalogCoin.isActive,
          createdAt: catalogCoin.createdAt,
          updatedAt: catalogCoin.lastUpdated,
        };
        console.log(`API: Found in coin catalog:`, {
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
        });
      } else {
        console.log(`API: Not found in coin catalog for symbol: ${symbol}`);
        // Debug: Let's see what's actually in the catalog
        const { db } = await import("./db");
        const { coinCatalog } = await import("../shared/schema");
        const { sql } = await import("drizzle-orm");
        const allCoins = await db.query.coinCatalog.findMany({
          where: sql`LOWER(${
            coinCatalog.symbol
          }) LIKE ${`%${symbol.toLowerCase()}%`}`,
          limit: 10,
        });
        console.log(
          `API: Similar coins in catalog:`,
          allCoins.map((c) => ({ symbol: c.symbol, name: c.name }))
        );
      }
    }

    // If still not found, try on-demand enrichment (for coins like AAPLX that come from search)
    if (!asset) {
      console.log(
        `API: Asset not found in catalog, trying on-demand enrichment for: ${symbol}`
      );
      const { enrichCatalogOnDemand } = await import("./coin-catalog-service");
      const enrichedCoin = await enrichCatalogOnDemand(symbol);

      if (enrichedCoin) {
        // Convert enriched coin to asset format
        asset = {
          id: enrichedCoin.id,
          symbol: enrichedCoin.symbol,
          name: enrichedCoin.name,
          type: "crypto" as const,
          apiSource: "coingecko" as const,
          isActive: enrichedCoin.isActive,
          createdAt: enrichedCoin.createdAt,
          updatedAt: enrichedCoin.lastUpdated,
        };
        console.log(`API: Found via on-demand enrichment:`, {
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
        });
      } else {
        console.log(`API: On-demand enrichment failed for: ${symbol}`);
      }
    }

    if (!asset) {
      console.log(
        `API: Asset not found in assets table or coin catalog for symbol: ${symbol}`
      );
      return res.status(404).json({ error: "Asset not found" });
    }

    console.log(`API: Found asset:`, {
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
    });
    res.json(asset);
  } catch (error) {
    console.error("API: Error fetching asset:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get asset",
    });
  }
});

// Create opinion for an asset
router.post("/assets/:symbol(*)/opinions", authMiddleware, async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);
    const { sentiment, comment } = req.body;

    // For now, return success until opinion service is implemented
    res.json({
      success: true,
      message: "Opinion created successfully",
      opinion: {
        id: "temp-id",
        symbol,
        sentiment,
        comment,
        userId: requireUser(req).userId,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to create opinion",
    });
  }
});

// Test price service debugging
router.get("/test/price-debug/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const { getLiveAssetPrice, getAssetBySymbol } = await import(
      "./price-service"
    );

    console.log(`Testing price service for symbol: ${symbol}`);

    // Test asset lookup
    const asset = await getAssetBySymbol(symbol);
    console.log("Asset lookup result:", asset);

    if (!asset) {
      return res.json({ error: "Asset not found", symbol });
    }

    // Test live price
    const price = await getLiveAssetPrice(symbol);
    console.log("Live price result:", price);

    res.json({
      symbol,
      asset,
      price,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Price debug error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Test ExchangeRate.host API
router.get("/test/exchangerate", async (req, res) => {
  try {
    const { base = "EUR", quote = "USD" } = req.query;
    const apiKey =
      process.env.EXCHANGERATE_API_KEY || "9782fcfa7c065df33f4f2ebacc986e4e";

    const apiUrl = apiKey
      ? `https://api.exchangerate.host/live?access_key=${apiKey}&base=${base}&currencies=${quote}`
      : `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`;

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Trend-App/1.0",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "ExchangeRate.host API error",
        status: response.status,
        statusText: response.statusText,
      });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({
        error: "ExchangeRate.host API error",
        details: data.error,
      });
    }

    // Handle both convert and latest endpoints
    const responseData =
      apiKey && data.result
        ? {
            success: true,
            from: data.query?.from,
            to: data.query?.to,
            amount: data.query?.amount,
            result: data.result,
            date: data.date,
            apiKeyUsed: true,
          }
        : {
            success: true,
            base: data.base,
            date: data.date,
            rates: data.rates,
            apiKeyUsed: false,
          };

    res.json(responseData);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to test ExchangeRate.host API",
    });
  }
});

// Manually update forex prices
router.post("/admin/update-forex", adminMiddleware, async (req, res) => {
  try {
    await updateForexPrices();
    res.json({ success: true, message: "Forex prices updated successfully" });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to update forex prices",
    });
  }
});

// ===== LEADERBOARD ROUTES =====

// Get monthly leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const { month, includeAdmins } = req.query;
    const monthParam = (month as string) || "previous";
    const includeAdminsParam = includeAdmins === "false" ? false : true;

    let leaderboardData: any[] = [];

    if (monthParam === "current") {
      leaderboardData = await getCurrentMonthLeaderboard();
    } else if (monthParam === "previous") {
      leaderboardData = await getMonthlyLeaderboard(undefined);
    } else {
      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(monthParam)) {
        return res
          .status(400)
          .json({ error: "Invalid month format. Use YYYY-MM" });
      }
      try {
        console.log(`Calling getMonthlyLeaderboard with month: ${monthParam}`);
        leaderboardData = await getMonthlyLeaderboard(monthParam);
        console.log(
          `getMonthlyLeaderboard returned ${leaderboardData.length} entries`
        );
      } catch (error) {
        console.error(
          `Error in getMonthlyLeaderboard for ${monthParam}:`,
          error
        );
        return res
          .status(500)
          .json({ error: "Failed to get monthly leaderboard data" });
      }
    }

    // Apply admin filtering if requested
    if (!includeAdminsParam && leaderboardData.length > 0) {
      // Get user roles for admin filtering
      const userIds = leaderboardData.map((entry) => entry.userId);
      const usersData = await db.query.users.findMany({
        where: inArray(users.id, userIds),
      });
      const userMap = new Map(usersData.map((user) => [user.id, user]));

      leaderboardData = leaderboardData.filter((entry) => {
        const user = userMap.get(entry.userId);
        return user && user.role !== "admin";
      });
    }

    // No fallback needed - getMonthlyLeaderboard now handles dynamic generation

    res.json({
      month: monthParam,
      includeAdmins: includeAdminsParam,
      data: leaderboardData,
      total: leaderboardData.length,
      timestamp: new Date().toISOString(),
      timezone: "Europe/Berlin",
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current month leaderboard (live scores)
router.get("/leaderboard/current", async (req, res) => {
  try {
    const { includeAdmins } = req.query;
    const includeAdminsParam = includeAdmins === "false" ? false : true;

    const leaderboardData = await getCurrentMonthLeaderboard();

    // Apply admin filtering if requested
    let filteredData = leaderboardData;
    if (!includeAdminsParam) {
      // Get user roles for admin filtering
      const userIds = leaderboardData.map((entry) => entry.userId);
      const usersData = await db.query.users.findMany({
        where: inArray(users.id, userIds),
      });
      const userMap = new Map(usersData.map((user) => [user.id, user]));

      filteredData = leaderboardData.filter((entry) => {
        const user = userMap.get(entry.userId);
        return user && user.role !== "admin";
      });
    }

    res.json({
      month: "current",
      includeAdmins: includeAdminsParam,
      data: filteredData,
      total: filteredData.length,
      timestamp: new Date().toISOString(),
      timezone: "Europe/Berlin",
    });
  } catch (error) {
    console.error("Error fetching current month leaderboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's current month stats
router.get("/leaderboard/user", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = extractUserFromToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userStats = await getUserCurrentMonthStats(decoded.userId);
    if (!userStats) {
      return res.status(404).json({ error: "User stats not found" });
    }

    res.json({
      ...userStats,
      timestamp: new Date().toISOString(),
      timezone: "Europe/Berlin",
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user's badges
router.get("/users/:userId/badges", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log("Badge endpoint called for userId:", userId);

    const { getUserBadges } = await import("./badge-service");
    const badges = await getUserBadges(userId);

    console.log(`Found ${badges.length} badges for user ${userId}:`, badges);
    res.json(badges);
  } catch (error) {
    console.error("Error fetching user badges:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get leaderboard statistics
router.get("/leaderboard/stats", async (req, res) => {
  try {
    const stats = await getLeaderboardStats();

    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
      timezone: "Europe/Berlin",
    });
  } catch (error) {
    console.error("Error fetching leaderboard stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current month countdown
router.get("/leaderboard/countdown", async (req, res) => {
  try {
    const countdown = getCurrentMonthCountdown();

    res.json({
      ...countdown,
      timestamp: new Date().toISOString(),
      timezone: "Europe/Berlin",
    });
  } catch (error) {
    console.error("Error fetching countdown:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ===== ADMIN ROUTES =====

// Get admin stats
router.get("/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get admin stats",
    });
  }
});

// Get admin dashboard overview
router.get("/admin/dashboard", adminMiddleware, async (req, res) => {
  try {
    const stats = await getAdminStats();
    const leaderboardStats = await getMonthlyLeaderboardStats();
    const topAssets = await getTopAssetsByVolume();
    const activeSlots = await getActiveSlots();

    res.json({
      stats,
      leaderboardStats,
      topAssets,
      activeSlots,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get dashboard data",
    });
  }
});

// Get all users
router.get("/admin/users", adminMiddleware, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get users",
    });
  }
});

// Get user details
router.get("/admin/users/:userId", adminMiddleware, async (req, res) => {
  try {
    const user = await getUserDetails(req.params.userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get user details",
    });
  }
});

// Get user predictions (admin)
router.get(
  "/admin/users/:userId/predictions",
  adminMiddleware,
  async (req, res) => {
    try {
      const predictions = await getUserPredictions(req.params.userId);
      res.json(predictions);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get user predictions",
      });
    }
  }
);

// Update user status
router.put("/admin/users/:userId", adminMiddleware, async (req, res) => {
  try {
    const user = await updateUser(req.params.userId, req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update user",
    });
  }
});

// Verify user email (admin)
router.post(
  "/admin/users/:userId/verify",
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await verifyUserEmail(req.params.userId);
      res.json({ message: "User email verified successfully", user });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify user email",
      });
    }
  }
);

// Deactivate user (admin)
router.post(
  "/admin/users/:userId/deactivate",
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await deactivateUser(req.params.userId);
      res.json({ message: "User deactivated successfully", user });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to deactivate user",
      });
    }
  }
);

// Activate user (admin)
router.post(
  "/admin/users/:userId/activate",
  adminMiddleware,
  async (req, res) => {
    try {
      const user = await activateUser(req.params.userId);
      res.json({ message: "User activated successfully", user });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to activate user",
      });
    }
  }
);

// Get unverified users (admin)
router.get("/admin/users/unverified", adminMiddleware, async (req, res) => {
  try {
    const users = await getUnverifiedUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get unverified users",
    });
  }
});

// ===== ADMIN PREDICTION ENDPOINTS =====

// Get all predictions with filters (admin)
router.get("/admin/predictions", adminMiddleware, async (req, res) => {
  try {
    const {
      status,
      result,
      assetSymbol,
      duration,
      userId,
      page = "1",
      limit = "50",
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 200);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const whereConditions = [];

    if (status) {
      whereConditions.push(eq(predictions.status, status as any));
    }

    if (result) {
      whereConditions.push(eq(predictions.result, result as any));
    }

    if (duration) {
      whereConditions.push(eq(predictions.duration, duration as any));
    }

    if (userId) {
      whereConditions.push(eq(predictions.userId, userId as string));
    }

    if (startDate) {
      whereConditions.push(
        gte(predictions.timestampCreated, new Date(startDate as string))
      );
    }

    if (endDate) {
      whereConditions.push(
        lte(predictions.timestampCreated, new Date(endDate as string))
      );
    }

    // Get predictions with user and asset info
    const allPredictions = await db
      .select({
        id: predictions.id,
        userId: predictions.userId,
        username: users.username,
        direction: predictions.direction,
        duration: predictions.duration,
        slotNumber: predictions.slotNumber,
        slotStart: predictions.slotStart,
        slotEnd: predictions.slotEnd,
        timestampCreated: predictions.timestampCreated,
        timestampExpiration: predictions.timestampExpiration,
        status: predictions.status,
        result: predictions.result,
        pointsAwarded: predictions.pointsAwarded,
        priceStart: predictions.priceStart,
        priceEnd: predictions.priceEnd,
        evaluatedAt: predictions.evaluatedAt,
        assetSymbol: assets.symbol,
        assetName: assets.name,
        assetType: assets.type,
      })
      .from(predictions)
      .innerJoin(users, eq(predictions.userId, users.id))
      .innerJoin(assets, eq(predictions.assetId, assets.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(predictions.timestampCreated)
      .limit(limitNum)
      .offset(offset);

    // Filter by asset symbol if provided
    let filteredPredictions = allPredictions;
    if (assetSymbol) {
      filteredPredictions = allPredictions.filter(
        (pred) => pred.assetSymbol === assetSymbol
      );
    }

    // Get total count
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(predictions)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const total = parseInt(totalCount[0]?.count?.toString() || "0");

    res.json({
      predictions: filteredPredictions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching admin predictions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manually evaluate a prediction (admin)
router.post(
  "/admin/predictions/:id/evaluate",
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { result, pointsAwarded, priceStart, priceEnd } = req.body;

      // Validate required fields
      if (!result || !["correct", "incorrect", "pending"].includes(result)) {
        return res.status(400).json({ error: "Invalid result value" });
      }

      // Get the prediction
      const prediction = await db
        .select()
        .from(predictions)
        .where(eq(predictions.id, id))
        .limit(1);

      if (prediction.length === 0) {
        return res.status(404).json({ error: "Prediction not found" });
      }

      const pred = prediction[0];

      // Update prediction
      await db
        .update(predictions)
        .set({
          status: "evaluated",
          result,
          pointsAwarded: pointsAwarded || 0,
          priceStart: priceStart ? priceStart.toString() : pred.priceStart,
          priceEnd: priceEnd ? priceEnd.toString() : pred.priceEnd,
          evaluatedAt: new Date(),
        })
        .where(eq(predictions.id, id));

      // Update user profile if points changed
      if (pointsAwarded !== undefined && pointsAwarded !== pred.pointsAwarded) {
        const pointsDiff = pointsAwarded - (pred.pointsAwarded || 0);

        await db
          .update(userProfiles)
          .set({
            monthlyScore: sql`${userProfiles.monthlyScore} + ${pointsDiff}`,
            totalScore: sql`${userProfiles.totalScore} + ${pointsDiff}`,
            totalPredictions: sql`${userProfiles.totalPredictions} + 1`,
            correctPredictions: sql`${userProfiles.correctPredictions} + ${
              result === "correct" ? 1 : 0
            }`,
          })
          .where(eq(userProfiles.userId, pred.userId));
      }

      res.json({
        message: "Prediction evaluated successfully",
        predictionId: id,
        result,
        pointsAwarded,
      });
    } catch (error) {
      console.error("Error evaluating prediction:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Trigger price recalculation for an asset (admin)
router.post("/admin/prices/recalc", adminMiddleware, async (req, res) => {
  try {
    const { assetSymbol, assetType } = req.body;

    if (!assetSymbol || !assetType) {
      return res
        .status(400)
        .json({ error: "Asset symbol and type are required" });
    }

    // Get asset
    const asset = await db
      .select()
      .from(assets)
      .where(eq(assets.symbol, assetSymbol))
      .limit(1);

    if (asset.length === 0) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Trigger price update
    await updateForexPrices();

    res.json({
      message: "Price recalculation triggered successfully",
      assetSymbol,
      assetType,
    });
  } catch (error) {
    console.error("Error triggering price recalculation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Trigger leaderboard recalculation (admin)
router.post("/admin/leaderboard/recalc", adminMiddleware, async (req, res) => {
  try {
    const { monthYear } = req.body;

    // Import the leaderboard archiver function
    const { triggerMonthlyArchive } = await import(
      "./workers/leaderboardArchiver.js"
    );

    // Trigger archive
    await triggerMonthlyArchive(monthYear);

    res.json({
      message: "Leaderboard recalculation triggered successfully",
      monthYear: monthYear || "previous month",
    });
  } catch (error) {
    console.error("Error triggering leaderboard recalculation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all assets (admin)
router.get("/admin/assets", adminMiddleware, async (req, res) => {
  try {
    const assets = await getAllAssets();
    res.json(assets);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get assets",
    });
  }
});

// Update asset price (admin)
router.put(
  "/admin/assets/:assetId/price",
  adminMiddleware,
  async (req, res) => {
    try {
      const { price } = req.body;
      if (!price || isNaN(Number(price))) {
        return res.status(400).json({ error: "Valid price is required" });
      }
      const asset = await updateAssetPrice(req.params.assetId, Number(price));
      res.json({ message: "Asset price updated successfully", asset });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to update asset price",
      });
    }
  }
);

// Add asset
router.post("/admin/assets", adminMiddleware, async (req, res) => {
  try {
    const assets = await addAsset(req.body);
    res.json(assets);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to add asset",
    });
  }
});

// Get asset price history (admin)
router.get(
  "/admin/assets/:assetId/prices",
  adminMiddleware,
  async (req, res) => {
    try {
      const { days = 7 } = req.query;
      const prices = await getAdminAssetPriceHistory(req.params.assetId);
      res.json(prices);
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to get price history",
      });
    }
  }
);

// Get all price feeds with filters
router.get("/admin/prices", adminMiddleware, async (req, res) => {
  try {
    const { asset, source, startDate, endDate } = req.query;
    const prices = await getAllPricesWithFilters({
      asset: asset as string,
      source: source as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json(prices);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get prices",
    });
  }
});

// Get leaderboard data
router.get("/admin/leaderboard", adminMiddleware, async (req, res) => {
  try {
    const data = await getMonthlyLeaderboardStats();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get leaderboard data",
    });
  }
});

// Get badge data
router.get("/admin/badges", adminMiddleware, async (req, res) => {
  try {
    const { month } = req.query;
    const data = await getBadgeData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get badge data",
    });
  }
});

// Trigger price update
router.post("/admin/prices/update", adminMiddleware, async (req, res) => {
  try {
    const result = await triggerPriceUpdate();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to trigger price update",
    });
  }
});

// Trigger badge backfill for existing users
router.post("/admin/badges/backfill", adminMiddleware, async (req, res) => {
  try {
    const { backfillBadgesForExistingUsers } = await import("./badge-service");
    const result = await backfillBadgesForExistingUsers();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to trigger badge backfill",
    });
  }
});

// Get badge statistics
router.get("/admin/badges/stats", adminMiddleware, async (req, res) => {
  try {
    const { getBadgeStatistics } = await import("./badge-service");
    const stats = await getBadgeStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get badge statistics",
    });
  }
});

// Import crypto assets from CoinGecko
router.post("/admin/crypto/import", adminMiddleware, async (req, res) => {
  try {
    const { fetchCryptoAssetsFromCoinGecko } = await import("./price-service");
    const result = await fetchCryptoAssetsFromCoinGecko();
    res.json({
      success: true,
      message: `Crypto import completed: ${result?.added || 0} added, ${
        result?.skipped || 0
      } skipped`,
      result,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to import crypto assets",
    });
  }
});

// Fetch prices for key assets
router.post("/admin/prices/fetch-key", adminMiddleware, async (req, res) => {
  try {
    const { fetchKeyAssetPrices } = await import("./price-service");
    await fetchKeyAssetPrices();
    res.json({
      success: true,
      message: "Key asset prices fetched successfully",
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch key asset prices",
    });
  }
});

// Mini leaderboard (Top 3 all-time + category kings)
router.get("/leaderboard/mini", async (req, res) => {
  try {
    // Top 3 users by all-time points (evaluated predictions only)
    const topThreeResult = await db.execute(sql`
      SELECT 
        p.user_id AS "userId",
        u.username AS "username",
        COALESCE(SUM(p.points_awarded), 0) AS "points",
        COUNT(*) AS "totalPredictions",
        SUM(CASE WHEN p.result = 'correct' THEN 1 ELSE 0 END) AS "correctPredictions"
      FROM predictions p
      JOIN users u ON u.id = p.user_id
      WHERE p.status = 'evaluated'
      GROUP BY p.user_id, u.username
      ORDER BY "points" DESC, "correctPredictions" DESC
      LIMIT 7
    `);

    // Stock King: highest all-time points on stock predictions
    const stockKingResult = await db.execute(sql`
      SELECT 
        p.user_id AS "userId",
        u.username AS "username",
        COALESCE(SUM(p.points_awarded), 0) AS "points"
      FROM predictions p
      JOIN users u ON u.id = p.user_id
      JOIN assets a ON a.id = p.asset_id
      WHERE p.status = 'evaluated' AND a.type = 'stock'
      GROUP BY p.user_id, u.username
      ORDER BY "points" DESC
      LIMIT 1
    `);

    // Crypto King: highest all-time points on crypto predictions
    const cryptoKingResult = await db.execute(sql`
      SELECT 
        p.user_id AS "userId",
        u.username AS "username",
        COALESCE(SUM(p.points_awarded), 0) AS "points"
      FROM predictions p
      JOIN users u ON u.id = p.user_id
      JOIN assets a ON a.id = p.asset_id
      WHERE p.status = 'evaluated' AND a.type = 'crypto'
      GROUP BY p.user_id, u.username
      ORDER BY "points" DESC
      LIMIT 1
    `);

    const response = {
      topThree: Array.isArray((topThreeResult as any).rows)
        ? (topThreeResult as any).rows
        : [],
      stockKing:
        Array.isArray((stockKingResult as any).rows) &&
        (stockKingResult as any).rows.length > 0
          ? (stockKingResult as any).rows[0]
          : null,
      cryptoKing:
        Array.isArray((cryptoKingResult as any).rows) &&
        (cryptoKingResult as any).rows.length > 0
          ? (cryptoKingResult as any).rows[0]
          : null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error generating mini leaderboard:", error);
    res.status(500).json({ error: "Failed to generate mini leaderboard" });
  }
});

// Get system health
router.get("/admin/health", adminMiddleware, async (req, res) => {
  try {
    const health = await getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get system health",
    });
  }
});

// ===== UTILITY ROUTES =====

// Search users
router.get("/search/users", async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Search query required" });
    }
    const users = await searchUsers(q as string, Number(limit), Number(offset));
    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to search users",
    });
  }
});

// Get users by rank
router.get("/users/ranked", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const users = await getUsersByRank(Number(limit), Number(offset));
    res.json(users);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to get ranked users",
    });
  }
});

// ===== Referral Routes =====
// Stats: total referred accounts for current user
router.get("/referral/stats", async (req, res) => {
  try {
    try {
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id uuid`
      );
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text UNIQUE`
      );
    } catch {}

    const current = await getAuthenticatedDbUser(req);
    if (!current) return res.status(404).json({ error: "User not found" });

    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE referred_by_user_id = ${current.id}
    `);
    const count = (result.rows?.[0] as any)?.count ?? 0;
    res.json({ referredCount: count });
  } catch (e) {
    res.status(500).json({ error: "Failed to get referral stats" });
  }
});
// Get current user's referral info
router.get("/referral", async (req, res) => {
  try {
    // Ensure schema column exists in environments where migrations haven't been run
    try {
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text UNIQUE`
      );
    } catch {}

    const user = await getAuthenticatedDbUser(req);
    if (!user) return res.status(404).json({ error: "User not found" });

    const code = user.referralCode || null;
    const link = code
      ? `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/auth?ref=${encodeURIComponent(code)}`
      : null;
    res.json({ referralCode: code, referralLink: link });
  } catch (e) {
    res.status(500).json({ error: "Failed to get referral info" });
  }
});

// ===== Public Feed =====
// Latest 10 public events: prediction_created, prediction_closed, badge_earned
router.get("/feed", async (req, res) => {
  try {
    // Build a unified feed using raw SQL UNION ALL
    const feedSql = sql`
      (
        SELECT 
          'prediction_created' AS type,
          p.timestamp_created AS created_at,
          p.id AS event_id,
          u.username AS username,
          a.symbol AS asset_symbol,
          p.direction AS direction,
          NULL::text AS result,
          NULL::int AS points_awarded,
          NULL::text AS badge_type
        FROM predictions p
        JOIN users u ON u.id = p.user_id
        JOIN assets a ON a.id = p.asset_id
      )
      UNION ALL
      (
        SELECT 
          'prediction_closed' AS type,
          p.evaluated_at AS created_at,
          p.id AS event_id,
          u.username AS username,
          a.symbol AS asset_symbol,
          p.direction AS direction,
          p.result::text AS result,
          COALESCE(p.points_awarded, 0) AS points_awarded,
          NULL::text AS badge_type
        FROM predictions p
        JOIN users u ON u.id = p.user_id
        JOIN assets a ON a.id = p.asset_id
        WHERE p.evaluated_at IS NOT NULL
      )
      UNION ALL
      (
        SELECT
          'badge_earned' AS type,
          b.created_at AS created_at,
          b.id AS event_id,
          u.username AS username,
          NULL AS asset_symbol,
          NULL AS direction,
          NULL AS result,
          NULL AS points_awarded,
          b.badge_type AS badge_type
        FROM user_badges b
        JOIN users u ON u.id = b.user_id
      )
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await db.execute(feedSql);
    const rows = (result.rows || []) as any[];
    const events = rows.map((row) => ({
      type: row.type,
      createdAt: row.created_at,
      id: row.event_id,
      username: row.username,
      assetSymbol: row.asset_symbol,
      direction: row.direction,
      result: row.result,
      pointsAwarded: row.points_awarded,
      badgeType: row.badge_type,
    }));

    res.json({ events });
  } catch (error) {
    console.error("Error building public feed:", error);
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// Dev helper: seed a few feed events quickly
router.post("/feed/dev/seed", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production")
      return res.status(403).json({ error: "Not allowed in production" });

    const user = await db.query.users.findFirst();
    const anyAsset = await db.query.assets.findFirst();
    if (!user || !anyAsset)
      return res
        .status(400)
        .json({ error: "Need at least one user and one asset" });

    // Create a fresh prediction (created event)
    const [pred] = await db
      .insert(predictions)
      .values({
        userId: user.id,
        assetId: anyAsset.id,
        direction: "up",
        duration: "short",
        slotNumber: 1,
        slotStart: new Date(Date.now() - 10 * 60 * 1000),
        slotEnd: new Date(Date.now() + 10 * 60 * 1000),
        timestampExpiration: new Date(Date.now() + 10 * 60 * 1000),
      })
      .returning();
    if (wsService)
      wsService.broadcastFeedEvent({
        type: "prediction_created",
        createdAt: new Date(),
        id: pred.id,
        username: user.username,
        assetSymbol: anyAsset.symbol,
        direction: "up",
      });

    // Close another prediction (closed event)
    const [pred2] = await db
      .insert(predictions)
      .values({
        userId: user.id,
        assetId: anyAsset.id,
        direction: "down",
        duration: "short",
        slotNumber: 1,
        slotStart: new Date(Date.now() - 2 * 60 * 60 * 1000),
        slotEnd: new Date(Date.now() - 60 * 60 * 1000),
        timestampExpiration: new Date(Date.now() - 60 * 60 * 1000),
        status: "evaluated",
        result: "correct",
        pointsAwarded: 10,
        priceStart: "100",
        priceEnd: "110",
        evaluatedAt: new Date(),
      })
      .returning();
    if (wsService)
      wsService.broadcastFeedEvent({
        type: "prediction_closed",
        createdAt: new Date(),
        id: pred2.id,
        username: user.username,
        assetSymbol: anyAsset.symbol,
        direction: "down",
        result: "correct",
        pointsAwarded: 10,
      });

    // Add a badge (badge event)
    const [badge] = await db
      .insert(userBadges)
      .values({
        userId: user.id,
        badgeType: "starter",
        badgeName: "Starter",
        badgeDescription: "First steps",
        monthYear: "lifetime",
        createdAt: new Date(),
      })
      .returning();
    if (wsService)
      wsService.broadcastFeedEvent({
        type: "badge_earned",
        createdAt: new Date(),
        id: badge.id,
        username: user.username,
        badgeType: "starter",
      });

    res.json({ ok: true, createdIds: { pred: pred.id, pred2: pred2.id } });
  } catch (e) {
    console.error("Feed dev seed error:", e);
    res.status(500).json({ error: "Failed to seed feed" });
  }
});
// Generate a unique referral code for current user
router.post("/referral/generate", async (req, res) => {
  try {
    // Ensure schema column exists in environments where migrations haven't been run
    try {
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text UNIQUE`
      );
    } catch {}

    const current = await getAuthenticatedDbUser(req);
    if (!current) return res.status(404).json({ error: "User not found" });

    if (current.referralCode) {
      const link = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/auth?ref=${encodeURIComponent(current.referralCode)}`;
      return res.json({
        referralCode: current.referralCode,
        referralLink: link,
      });
    }

    let code: string;
    // Try generating a unique code a few times
    for (let i = 0; i < 5; i++) {
      code = crypto.randomBytes(4).toString("hex");
      const exists = await db.query.users.findFirst({
        where: eq(users.referralCode, code),
      });
      if (!exists) break;
    }

    const [updated] = await db
      .update(users)
      .set({ referralCode: code! })
      .where(eq(users.id, current.id))
      .returning();
    const link = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/auth?ref=${encodeURIComponent(updated.referralCode!)}`;
    res.json({ referralCode: updated.referralCode, referralLink: link });
  } catch (e) {
    res.status(500).json({ error: "Failed to generate referral code" });
  }
});

// Accept referral for current user using a referral code
router.post("/referral/accept", async (req, res) => {
  try {
    // Ensure schema columns
    try {
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text UNIQUE`
      );
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id uuid`
      );
    } catch {}

    const current = await getAuthenticatedDbUser(req);
    if (!current) return res.status(401).json({ error: "Unauthorized" });

    const { code } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Referral code is required" });
    }

    // Already attributed?
    if (current.referredByUserId) {
      return res.json({ ok: true, message: "Referral already attributed" });
    }

    const refOwner = await db.query.users.findFirst({
      where: eq(users.referralCode, code),
    });
    if (!refOwner)
      return res.status(404).json({ error: "Invalid referral code" });
    if (refOwner.id === current.id)
      return res
        .status(400)
        .json({ error: "Cannot use your own referral code" });

    await db
      .update(users)
      .set({ referredByUserId: refOwner.id })
      .where(eq(users.id, current.id));

    // Return updated count for owner and broadcast via WS
    const countResult = await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM users WHERE referred_by_user_id = ${refOwner.id}`
    );
    const referredCount = (countResult.rows?.[0] as any)?.c ?? 0;
    if (wsService) {
      try {
        wsService.broadcastReferralUpdate(refOwner.id, referredCount);
      } catch {}
    }
    res.json({ ok: true, referredCount });
  } catch (e) {
    console.error("Accept referral error:", e);
    res.status(500).json({ error: "Failed to accept referral" });
  }
});
// Initialize system (run once)
router.post("/init", async (req, res) => {
  try {
    await Promise.all([initializeSlotConfigs(), initializeDefaultAssets()]);
    res.json({ message: "System initialized successfully" });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to initialize system",
    });
  }
});

// Evaluate expired predictions (cron job endpoint)
router.post("/cron/evaluate-predictions", async (req, res) => {
  try {
    await evaluateExpiredPredictions();
    res.json({ message: "Predictions evaluated successfully" });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to evaluate predictions",
    });
  }
});

// Development-only: seed demo data for mini leaderboard
router.post("/dev/seed-mini-leaderboard", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Not allowed in production" });
    }

    // Ensure there are at least some assets
    const existingAssets = await db.query.assets.findMany();
    if (existingAssets.length === 0) {
      await initializeDefaultAssets();
    }

    // Create or find three demo users
    const demoUsers = [
      { username: "demo_alice", email: "alice@example.com" },
      { username: "demo_bob", email: "bob@example.com" },
      { username: "demo_chris", email: "chris@example.com" },
    ];

    const createdUsers: Array<{ id: string; username: string }> = [];
    for (const du of demoUsers) {
      let u = await db.query.users.findFirst({
        where: eq(users.email, du.email),
      });
      if (!u) {
        const [nu] = await db
          .insert(users)
          .values({
            username: du.username,
            email: du.email,
            password: "seeded",
            emailVerified: true,
            role: "user",
          })
          .returning();
        await db.insert(userProfiles).values({ userId: nu.id });
        u = nu;
      }
      createdUsers.push({ id: u.id, username: u.username });
    }

    // Pick one stock and one crypto
    const stock = await db.query.assets.findFirst({
      where: eq(assets.type, "stock"),
    });
    const crypto = await db.query.assets.findFirst({
      where: eq(assets.type, "crypto"),
    });

    if (!stock || !crypto) {
      return res.status(400).json({
        error: "Missing stock/crypto assets. Initialize assets first.",
      });
    }

    // Helper to add an evaluated prediction with points
    const addEvaluated = async (
      userId: string,
      assetId: string,
      direction: "up" | "down",
      points: number
    ) => {
      const now = new Date();
      const start = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const end = new Date(now.getTime() - 60 * 60 * 1000);
      await db.insert(predictions).values({
        userId,
        assetId,
        direction,
        duration: "short",
        slotNumber: 1,
        slotStart: start,
        slotEnd: end,
        timestampExpiration: end,
        status: "evaluated",
        result: points > 0 ? "correct" : "incorrect",
        pointsAwarded: points,
        priceStart: "100",
        priceEnd: "110",
        evaluatedAt: end,
      });
      // update profile totals roughly
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
      });
      if (profile) {
        await db
          .update(userProfiles)
          .set({
            monthlyScore: (profile.monthlyScore || 0) + points,
            totalScore: (profile.totalScore || 0) + points,
            totalPredictions: (profile.totalPredictions || 0) + 1,
            correctPredictions:
              (profile.correctPredictions || 0) + (points > 0 ? 1 : 0),
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, userId));
      }
    };

    // Seed points:
    // Alice strong on stocks
    await addEvaluated(createdUsers[0].id, stock.id, "up", 30);
    await addEvaluated(createdUsers[0].id, stock.id, "up", 20);
    // Bob balanced
    await addEvaluated(createdUsers[1].id, crypto.id, "up", 25);
    await addEvaluated(createdUsers[1].id, stock.id, "down", 15);
    // Chris strong on crypto
    await addEvaluated(createdUsers[2].id, crypto.id, "up", 40);

    res.json({
      message: "Seeded demo mini leaderboard data",
      users: createdUsers.map((u) => u.username),
    });
  } catch (error) {
    console.error("Seed mini leaderboard error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to seed demo data",
    });
  }
});
// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

// Get user notifications
router.get("/notifications", authMiddleware, async (req, res) => {
  try {
    console.log("📬 GET /api/notifications - Request received");
    console.log("   User:", req.user);
    console.log("   Query params:", req.query);

    const { getUserNotifications } = await import(
      "./follow-notification-service"
    );
    const { limit, offset, unreadOnly } = req.query;

    const notifications = await getUserNotifications(requireUser(req).userId, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      unreadOnly: unreadOnly === "true",
    });

    console.log("   Notifications found:", notifications.length);
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch notifications",
    });
  }
});

// Get unread notification count
router.get("/notifications/unread/count", authMiddleware, async (req, res) => {
  try {
    console.log("🔔 GET /api/notifications/unread/count - Request received");
    console.log("   User:", req.user);

    const { getUnreadNotificationCount } = await import(
      "./follow-notification-service"
    );
    const count = await getUnreadNotificationCount(requireUser(req).userId);

    console.log("   Unread count:", count);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to fetch unread count",
    });
  }
});

// Mark notification as read
router.patch("/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    const { markNotificationAsRead } = await import(
      "./follow-notification-service"
    );
    const notification = await markNotificationAsRead(
      req.params.id,
      requireUser(req).userId
    );
    res.json(notification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark notification as read",
    });
  }
});

// Mark all notifications as read
router.patch("/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    const { markAllNotificationsAsRead } = await import(
      "./follow-notification-service"
    );
    await markAllNotificationsAsRead(requireUser(req).userId);
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark all notifications as read",
    });
  }
});

// Delete notification
router.delete("/notifications/:id", authMiddleware, async (req, res) => {
  try {
    const { deleteNotification } = await import(
      "./follow-notification-service"
    );
    await deleteNotification(req.params.id, requireUser(req).userId);
    res.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete notification",
    });
  }
});

// Save FCM token
router.post("/notifications/fcm-token", authMiddleware, async (req, res) => {
  try {
    const { saveFCMToken } = await import("./follow-notification-service");
    const { token, deviceInfo } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const fcmToken = await saveFCMToken(
      requireUser(req).userId,
      token,
      deviceInfo
    );
    res.json(fcmToken);
  } catch (error) {
    console.error("Error saving FCM token:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to save FCM token",
    });
  }
});

// Delete FCM token
router.delete("/notifications/fcm-token", authMiddleware, async (req, res) => {
  try {
    const { deleteFCMToken } = await import("./follow-notification-service");
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    await deleteFCMToken(token);
    res.json({ message: "FCM token deleted" });
  } catch (error) {
    console.error("Error deleting FCM token:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to delete FCM token",
    });
  }
});

export default router;
