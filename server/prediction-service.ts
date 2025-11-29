import { db } from "./db";
import {
  predictions,
  assets,
  userProfiles,
  slotConfigs,
  users,
} from "../shared/schema";
import { eq, and, or, desc, asc, inArray, lt } from "drizzle-orm";
import { getAssetPrice, getLiveAssetPrice } from "./price-service";
import { wsService } from "./index";
import {
  getCurrentActiveSlot,
  isWithinActiveSlot,
  getSlotForDate,
  getPointsForSlot,
  isSlotValid,
} from "./lib/slots.js";
import { sql } from "drizzle-orm";

// Use the slot service functions instead of duplicating logic

export interface CreatePredictionInput {
  userId: string;
  assetSymbol: string;
  direction: "up" | "down";
  duration: "short" | "medium" | "long";
  slotNumber: number;
  currentPrice?: number; // optional client-provided fresh price
}

export interface PredictionWithAsset {
  id: string;
  userId: string;
  assetSymbol: string;
  assetName: string;
  assetType: string;
  direction: "up" | "down";
  duration: string; // Support all duration types
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

export interface SentimentData {
  slotNumber: number;
  upCount: number;
  downCount: number;
  totalCount: number;
}

// Create a new prediction
export async function createPrediction(input: CreatePredictionInput) {
  console.log("=== PREDICTION CREATION START ===");
  console.log("Input received:", input);
  const {
    userId,
    assetSymbol,
    direction,
    duration,
    slotNumber,
    currentPrice: clientProvidedPrice,
  } = input;

  // Check if user's email is verified
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.emailVerified) {
    throw new Error(
      "Email verification required. Please verify your email before making predictions."
    );
  }

  // Get the asset. If it doesn't exist in assets table but exists in coin catalog,
  // create it on-the-fly so predictions can reference a valid assetId.
  let asset = await db.query.assets.findFirst({
    where: eq(assets.symbol, assetSymbol),
  });

  if (!asset) {
    try {
      const { coinCatalog } = await import("../shared/schema");
      const catalogEntry = await db.query.coinCatalog.findFirst({
        where: eq(coinCatalog.symbol, assetSymbol.toUpperCase()),
      });

      if (catalogEntry) {
        const [inserted] = await db
          .insert(assets)
          .values({
            name: catalogEntry.name,
            symbol: catalogEntry.symbol,
            type: (catalogEntry.type as any) || "crypto",
            apiSource: "coingecko",
            isActive: true,
          })
          .returning();
        asset = inserted as any;
        console.log("Created missing asset from catalog for prediction:", {
          symbol: asset?.symbol,
          id: asset?.id,
        });
      }
    } catch (e) {
      console.error("Error checking/creating asset from coin catalog:", e);
    }
  }

  if (!asset) {
    throw new Error("Asset not found");
  }

  if (!asset.isActive) {
    throw new Error("Asset is not available for predictions");
  }

  // slotNumber is already destructured above
  if (!slotNumber) {
    throw new Error("Slot number is required");
  }

  // Get slot information for the selected slot
  const selectedSlot = getSlotForDate(new Date(), duration);
  console.log("Slot validation:", {
    slotNumber,
    duration,
    selectedSlot: {
      slotNumber: selectedSlot.slotNumber,
      slotStart: selectedSlot.slotStart.toJSDate(),
      slotEnd: selectedSlot.slotEnd.toJSDate(),
    },
  });

  // In simplified system, only slot 1 is valid
  if (slotNumber !== 1) {
    throw new Error(
      "Invalid slot number. Only slot 1 is available in the simplified system"
    );
  }

  // Check if slot is still active (not expired) - for simplified slot system
  const now = new Date();
  const slotStartTime = selectedSlot.slotStart.toJSDate();
  const slotEndTime = selectedSlot.slotEnd.toJSDate();

  console.log("Time validation:", {
    now: now.toISOString(),
    slotStartTime: slotStartTime.toISOString(),
    slotEndTime: slotEndTime.toISOString(),
    isSlotActive: now >= slotStartTime && now <= slotEndTime,
  });

  // For simplified slot system, only check if slot is still active (not expired)
  if (now < slotStartTime) {
    throw new Error(
      "Cannot create predictions for slots that have not started yet"
    );
  }

  if (now > slotEndTime) {
    throw new Error(
      "Cannot create predictions for slots that have already ended"
    );
  }

  // Check if user already has a prediction for this asset, duration, and slot
  const existingPrediction = await db.query.predictions.findFirst({
    where: and(
      eq(predictions.userId, userId),
      eq(predictions.assetId, asset.id),
      eq(predictions.duration, duration), // Use the new enum values directly
      eq(predictions.slotNumber, slotNumber),
      eq(predictions.slotStart, selectedSlot.slotStart.toJSDate())
    ),
  });

  if (existingPrediction) {
    throw new Error(
      "You already have a prediction for this asset in the selected slot"
    );
  }

  // The selected slot is already validated as valid (current or future) above
  // No need to check if we're within the active slot window

  // Determine the price to use for prediction start
  // Prefer the client-provided fresh price (frontend already fetched just-in-time)
  let currentPrice: number | null = null;
  if (typeof clientProvidedPrice === "number" && clientProvidedPrice > 0) {
    currentPrice = clientProvidedPrice;
    console.log(
      `Using client-provided fresh price for ${assetSymbol}: ${currentPrice}`
    );
  } else {
    // Fallback to server-side fresh fetch
    console.log(
      `Client price not provided/invalid. Fetching live price for ${assetSymbol}...`
    );
    const livePrice = await getLiveAssetPrice(assetSymbol);
    if (!livePrice) {
      console.error(
        `Failed to get live price for ${assetSymbol}, falling back to cached price`
      );
      const cachedPrice = await getAssetPrice(assetSymbol);
      currentPrice = cachedPrice || null;
    } else {
      currentPrice = livePrice;
    }
  }

  if (!currentPrice || currentPrice <= 0) {
    throw new Error("Unable to get current asset price");
  }

  console.log(
    `Prediction submission - ${assetSymbol} price_start: ${currentPrice}`
  );

  // Create prediction
  const [prediction] = await db
    .insert(predictions)
    .values({
      userId,
      assetId: asset.id,
      direction,
      duration: duration, // Use the new enum values directly
      slotNumber: slotNumber,
      slotStart: selectedSlot.slotStart.toJSDate(),
      slotEnd: selectedSlot.slotEnd.toJSDate(),
      timestampExpiration: selectedSlot.slotEnd.toJSDate(),
      priceStart: currentPrice.toString(),
    })
    .returning();

  // Update user's total predictions count (increment by 1)
  try {
    console.log(
      `Updating prediction count for user ${userId} - incrementing totalPredictions`
    );

    // First check if user profile exists
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    if (!existingProfile) {
      console.log(`No user profile found for ${userId}, creating one...`);
      await db.insert(userProfiles).values({
        userId,
        totalPredictions: 1,
      });
      console.log(
        `Created user profile for ${userId} with totalPredictions: 1`
      );
    } else {
      console.log(
        `Existing profile for ${userId}: totalPredictions = ${existingProfile.totalPredictions}`
      );

      const [updatedProfile] = await db
        .update(userProfiles)
        .set({
          totalPredictions: sql`${userProfiles.totalPredictions} + 1`,
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      console.log(
        `Successfully updated user profile for ${userId}. New totalPredictions: ${updatedProfile?.totalPredictions}`
      );
    }
  } catch (error) {
    console.error(
      `Failed to update user profile prediction count for ${userId}:`,
      error
    );
    // Non-critical error - prediction was created successfully
  }

  // Broadcast prediction update via WebSocket for real-time sentiment updates
  try {
    if (wsService && user && asset) {
      wsService.broadcastFeedEvent({
        type: "prediction_created",
        createdAt: new Date(),
        id: prediction.id,
        username: user.username,
        assetSymbol: asset.symbol,
        direction,
      });
    }
  } catch (error) {
    console.error("Failed to broadcast prediction update:", error);
    // Non-critical error - prediction was created successfully
  }

  // Notify followers about the new prediction
  try {
    const { notifyFollowersOfNewPrediction } = await import(
      "./follow-notification-service"
    );
    await notifyFollowersOfNewPrediction(userId, prediction.id, asset.id);
  } catch (error) {
    console.error("Failed to notify followers:", error);
    // Non-critical error - prediction was created successfully
  }

  return prediction;
}

// Get user's predictions
export async function getUserPredictions(
  userId: string,
  options?: {
    status?: "active" | "expired" | "evaluated";
    assetSymbol?: string;
    limit?: number;
    offset?: number;
  }
) {
  const { status, assetSymbol, limit = 50, offset = 0 } = options || {};

  let whereConditions = [eq(predictions.userId, userId)];

  if (status) {
    whereConditions.push(eq(predictions.status, status));
  }

  if (assetSymbol) {
    // We can't filter by asset symbol directly in the query due to the join
    // We'll filter after fetching the data
  }

  console.log("getUserPredictions - userId:", userId);
  console.log("getUserPredictions - whereConditions:", whereConditions);

  const userPredictions = await db.query.predictions.findMany({
    where: and(...whereConditions),
    orderBy: [desc(predictions.timestampCreated)],
    limit,
    offset,
  });

  console.log(
    "getUserPredictions - found predictions:",
    userPredictions.length
  );
  console.log(
    "getUserPredictions - first prediction userId:",
    userPredictions[0]?.userId
  );

  // Get assets for the predictions
  const assetIds = Array.from(
    new Set(userPredictions.map((pred) => pred.assetId))
  );
  let assetsData: any[] = [];
  if (assetIds.length > 0) {
    assetsData = await db.query.assets.findMany({
      where: inArray(assets.id, assetIds),
    });
  }
  const assetMap = new Map(assetsData.map((asset) => [asset.id, asset]));

  // Filter by asset symbol if provided
  let filteredPredictions = userPredictions;
  if (assetSymbol) {
    filteredPredictions = userPredictions.filter((pred) => {
      const asset = assetMap.get(pred.assetId);
      return asset && asset.symbol === assetSymbol;
    });
  }

  const result = filteredPredictions.map((pred) => {
    const asset = assetMap.get(pred.assetId);
    const mappedPrediction = {
      id: pred.id,
      userId: pred.userId,
      assetId: pred.assetId,
      asset: {
        name: asset?.name || "Unknown",
        symbol: asset?.symbol || "Unknown",
        type: asset?.type || "Unknown",
      },
      direction: pred.direction,
      duration: pred.duration,
      slotNumber: pred.slotNumber,
      slotStart: pred.slotStart,
      slotEnd: pred.slotEnd,
      timestampCreated: pred.timestampCreated,
      timestampExpiration: pred.timestampExpiration,
      status: pred.status,
      result: pred.result,
      pointsAwarded: pred.pointsAwarded,
      priceStart: pred.priceStart,
      priceEnd: pred.priceEnd,
    };

    // Debug logging for each prediction
    console.log("Mapped prediction:", {
      id: mappedPrediction.id,
      direction: mappedPrediction.direction,
      status: mappedPrediction.status,
      result: mappedPrediction.result,
      asset: mappedPrediction.asset,
    });

    return mappedPrediction;
  });

  console.log("getUserPredictions returning:", {
    count: result.length,
    sample: result[0],
  });

  return result;
}

// Get predictions for sentiment chart
export async function getSentimentData(
  assetSymbol: string,
  duration: string
): Promise<SentimentData[]> {
  console.log(
    `getSentimentData: Fetching sentiment for ${assetSymbol} with duration ${duration}`
  );

  const asset = await db.query.assets.findFirst({
    where: eq(assets.symbol, assetSymbol),
  });

  if (!asset) {
    console.log(`getSentimentData: Asset not found for symbol ${assetSymbol}`);
    throw new Error("Asset not found");
  }

  console.log(`getSentimentData: Found asset:`, {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    type: asset.type,
  });

  // Get all predictions for this asset and duration
  const allPredictions = await db.query.predictions.findMany({
    where: and(
      eq(predictions.assetId, asset.id),
      eq(predictions.duration, duration as "short" | "medium" | "long")
    ),
  });

  console.log(
    `getSentimentData: Found ${allPredictions.length} predictions for ${assetSymbol} with duration ${duration}`
  );

  // Group predictions by slot
  const slotData = new Map<number, { up: number; down: number }>();

  // Count predictions by slot and direction
  allPredictions.forEach((prediction) => {
    if (!slotData.has(prediction.slotNumber)) {
      slotData.set(prediction.slotNumber, { up: 0, down: 0 });
    }

    const slot = slotData.get(prediction.slotNumber)!;
    if (prediction.direction === "up") {
      slot.up++;
    } else {
      slot.down++;
    }
  });

  console.log(`getSentimentData: Slot data:`, Object.fromEntries(slotData));

  // Convert to array format and sort by slot number
  const result = Array.from(slotData.entries())
    .map(([slotNumber, counts]) => ({
      slotNumber,
      upCount: counts.up,
      downCount: counts.down,
      totalCount: counts.up + counts.down,
    }))
    .sort((a, b) => a.slotNumber - b.slotNumber);

  console.log(`getSentimentData: Final result:`, result);
  return result;
}

// Evaluate expired predictions
export async function evaluateExpiredPredictions() {
  try {
    console.log("Starting prediction evaluation...");

    // Get all expired predictions that haven't been evaluated
    const expiredPredictions = await db.query.predictions.findMany({
      where: and(
        eq(predictions.status, "active"),
        lt(predictions.timestampExpiration, new Date())
      ),
    });

    console.log(
      `Found ${expiredPredictions.length} expired predictions to evaluate`
    );

    for (const prediction of expiredPredictions) {
      try {
        await evaluatePrediction(prediction.id);
      } catch (error) {
        console.error(`Failed to evaluate prediction ${prediction.id}:`, error);
      }
    }

    console.log("Prediction evaluation completed");
  } catch (error) {
    console.error("Error in prediction evaluation:", error);
  }
}

// Evaluate a single prediction
export async function evaluatePrediction(predictionId: string) {
  try {
    // Get the prediction
    const prediction = await db.query.predictions.findFirst({
      where: eq(predictions.id, predictionId),
    });

    if (!prediction) {
      throw new Error("Prediction not found");
    }

    // Get the user
    const predictionUser = await db.query.users.findFirst({
      where: eq(users.id, prediction.userId),
    });

    if (!predictionUser) {
      throw new Error("User not found");
    }

    // Get the asset
    const asset = await db.query.assets.findFirst({
      where: eq(assets.id, prediction.assetId),
    });

    if (!asset) {
      throw new Error("Asset not found");
    }

    // Get current asset price
    const currentPrice =
      (await getLiveAssetPrice(asset.symbol)) ||
      (await getAssetPrice(asset.symbol));

    if (!currentPrice) {
      throw new Error("No current price available");
    }

    // Get the prediction's start and end prices
    const priceStart = parseFloat(prediction.priceStart || "0");
    const priceEnd = parseFloat(currentPrice.toString());

    if (!priceStart || !priceEnd) {
      throw new Error("Missing price data");
    }

    // Determine if prediction was correct
    let result: "correct" | "incorrect" = "incorrect";
    let pointsAwarded = 0;

    if (prediction.direction === "up" && priceEnd > priceStart) {
      result = "correct";
    } else if (prediction.direction === "down" && priceEnd < priceStart) {
      result = "correct";
    }

    // Calculate points based on new simplified system
    if (result === "correct") {
      // Use the new points calculation based on when prediction was made
      const { getPointsForPrediction } = await import("./lib/slots.js");
      const predictionTime = prediction.timestampCreated || new Date();
      pointsAwarded = getPointsForPrediction(
        prediction.duration as any,
        predictionTime as any
      );
    } else {
      // Fixed penalty for incorrect prediction (independent of timing)
      const { getPenaltyForPrediction } = await import("./lib/slots.js");
      pointsAwarded = getPenaltyForPrediction(prediction.duration as any);
    }

    // Update prediction with result
    await db
      .update(predictions)
      .set({
        status: "evaluated",
        result,
        pointsAwarded,
        priceEnd: priceEnd.toString(),
        evaluatedAt: new Date(),
      })
      .where(eq(predictions.id, prediction.id));

    // Update user profile with new score
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, prediction.userId),
    });

    if (userProfile) {
      const newMonthlyScore = (userProfile.monthlyScore || 0) + pointsAwarded;
      const newTotalPredictions = (userProfile.totalPredictions || 0) + 1;
      const newCorrectPredictions =
        (userProfile.correctPredictions || 0) + (result === "correct" ? 1 : 0);

      await db
        .update(userProfiles)
        .set({
          monthlyScore: newMonthlyScore,
          totalPredictions: newTotalPredictions,
          correctPredictions: newCorrectPredictions,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, prediction.userId));

      console.log(
        `Updated user ${prediction.userId} profile: score=${newMonthlyScore}, predictions=${newTotalPredictions}, correct=${newCorrectPredictions}`
      );
    }

    // Check and award badges after updating user profile
    try {
      const { checkAndAwardBadges } = await import("./badge-service");
      const newBadges = await checkAndAwardBadges(prediction.userId);

      if (newBadges.length > 0) {
        console.log(
          `User ${prediction.userId} earned ${newBadges.length} new badges:`,
          newBadges.map((b) => b.badgeName)
        );

        // TODO: Broadcast badge notification via WebSocket
        // if (wsService) {
        //   wsService.broadcastToUser(prediction.userId, 'badge-earned', {
        //     badges: newBadges,
        //     message: `Congratulations! You earned ${newBadges.length} new badge${newBadges.length > 1 ? 's' : ''}!`
        //   });
        // }
      }
    } catch (error) {
      console.error(
        `Error checking badges for user ${prediction.userId}:`,
        error
      );
      // Don't fail the prediction evaluation if badge checking fails
    }

    // Broadcast leaderboard update via WebSocket
    try {
      if (wsService && asset) {
        wsService.broadcastFeedEvent({
          type: "prediction_closed",
          createdAt: new Date(),
          id: prediction.id,
          username: predictionUser?.username || null,
          assetSymbol: asset.symbol,
          direction: prediction.direction,
          result,
          pointsAwarded,
        });
      }
    } catch (error) {
      console.error("Failed to broadcast leaderboard update:", error);
      // Non-critical error
    }

    console.log(
      `Prediction ${prediction.id} evaluated: ${result}, points: ${pointsAwarded}`
    );
    return { result, pointsAwarded };
  } catch (error) {
    console.error(`Error evaluating prediction ${predictionId}:`, error);
    throw error;
  }
}

// Get prediction statistics for a user
export async function getUserPredictionStats(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracyPercentage: 0,
      monthlyScore: 0,
      totalScore: 0,
    };
  }

  const accuracyPercentage =
    profile.totalPredictions > 0
      ? (profile.correctPredictions / profile.totalPredictions) * 100
      : 0;

  return {
    totalPredictions: profile.totalPredictions,
    correctPredictions: profile.correctPredictions,
    accuracyPercentage: Math.round(accuracyPercentage * 100) / 100,
    monthlyScore: profile.monthlyScore,
    totalScore: profile.totalScore,
  };
}

// Get active predictions count for a user
export async function getActivePredictionsCount(
  userId: string
): Promise<number> {
  const count = await db.query.predictions.findMany({
    where: and(
      eq(predictions.userId, userId),
      eq(predictions.status, "active")
    ),
  });

  return count.length;
}
