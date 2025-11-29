import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { db } from '../server/db';
import { users, userProfiles, assets, predictions } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { initializeDefaultAssets } from '../server/price-service';

async function run() {
  try {
    console.log('Seeding mini leaderboard demo data...');

    const existingAssets = await db.query.assets.findMany();
    if (existingAssets.length === 0) {
      console.log('Initializing default assets...');
      await initializeDefaultAssets();
    }

    const demoUsers = [
      { username: 'demo_alice', email: 'alice@example.com' },
      { username: 'demo_bob', email: 'bob@example.com' },
      { username: 'demo_chris', email: 'chris@example.com' },
    ];

    const created: Array<{ id: string; username: string }> = [];
    for (const du of demoUsers) {
      let u = await db.query.users.findFirst({ where: eq(users.email, du.email) });
      if (!u) {
        const [nu] = await db.insert(users).values({
          username: du.username,
          email: du.email,
          password: 'seeded',
          emailVerified: true,
          role: 'user',
        }).returning();
        await db.insert(userProfiles).values({ userId: nu.id });
        u = nu;
      }
      created.push({ id: u.id, username: u.username });
    }

    const stock = await db.query.assets.findFirst({ where: eq(assets.type, 'stock') });
    const crypto = await db.query.assets.findFirst({ where: eq(assets.type, 'crypto') });
    if (!stock || !crypto) {
      throw new Error('Missing stock/crypto assets. Initialize assets first.');
    }

    const addEvaluated = async (userId: string, assetId: string, direction: 'up' | 'down', points: number) => {
      const now = new Date();
      const start = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const end = new Date(now.getTime() - 60 * 60 * 1000);
      await db.insert(predictions).values({
        userId,
        assetId,
        direction,
        duration: 'short',
        slotNumber: 1,
        slotStart: start,
        slotEnd: end,
        timestampExpiration: end,
        status: 'evaluated',
        result: points > 0 ? 'correct' : 'incorrect',
        pointsAwarded: points,
        priceStart: '100',
        priceEnd: '110',
        evaluatedAt: end,
      });
      const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, userId) });
      if (profile) {
        await db.update(userProfiles).set({
          monthlyScore: (profile.monthlyScore || 0) + points,
          totalScore: (profile.totalScore || 0) + points,
          totalPredictions: (profile.totalPredictions || 0) + 1,
          correctPredictions: (profile.correctPredictions || 0) + (points > 0 ? 1 : 0),
          updatedAt: new Date(),
        }).where(eq(userProfiles.userId, userId));
      }
    };

    // Alice strong on stocks
    await addEvaluated(created[0].id, stock.id, 'up', 30);
    await addEvaluated(created[0].id, stock.id, 'up', 20);
    // Bob balanced
    await addEvaluated(created[1].id, crypto.id, 'up', 25);
    await addEvaluated(created[1].id, stock.id, 'down', 15);
    // Chris strong on crypto
    await addEvaluated(created[2].id, crypto.id, 'up', 40);

    console.log('Done. Users:', created.map(u => u.username));
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e);
    process.exit(1);
  }
}

run();


