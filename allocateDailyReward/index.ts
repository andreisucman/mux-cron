import * as dotenv from "dotenv";
dotenv.config();

import { db, client, adminDb, stripe } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import setUtcMidnight, {
  getTotalDaysInCurrentMonth,
  getIsToday,
} from "helpers/utils.js";
import { ObjectId } from "mongodb";

async function run() {
  try {
    const latestAllocation = (await doWithRetries(async () =>
      adminDb
        .collection("Cron")
        .find(
          { functionName: "allocateDailyReward", isError: false },
          { projection: { createdAt: 1 } }
        )
        .sort({ createdAt: -1 })
        .next()
    )) as unknown as { createdAt: Date | null };

    const { createdAt } = latestAllocation || {};

    const isToday = getIsToday(createdAt);

    if (createdAt && isToday) throw new Error("Already ran today");

    const peekPlanInfo = await doWithRetries(async () =>
      db
        .collection("Plan")
        .findOne({ name: "peek" }, { projection: { priceId: 1 } })
    );

    const { priceId } = peekPlanInfo;

    const stripePeekPriceObject = await stripe.prices.retrieve(priceId);
    const price = stripePeekPriceObject.unit_amount / 100;

    const totalDaysInCurrentMonth = getTotalDaysInCurrentMonth();

    const dailyRewardShare =
      (price / totalDaysInCurrentMonth) *
        (1 - Number(process.env.STRIPE_PROCESSING_SHARE)) -
      -Number(process.env.STRIPE_PROCESSING_FEE);

    const toIncrement = await doWithRetries(async () =>
      db
        .collection("User")
        .aggregate([
          {
            $match: {
              "club.followingUserId": { $exists: true },
              "subscriptions.peek.validUntil": { $gte: new Date() },
            },
          },
          {
            $group: {
              _id: null,
              ids: { $addToSet: "$club.followingUserId" },
            },
          },
          { $project: { _id: 0, ids: 1 } },
        ])
        .next()
    );

    const bulkOperations: any[] = [];

    if (toIncrement && toIncrement.ids.length > 0) {
      const batchSize = 500;
      const now = setUtcMidnight({ date: new Date() });

      const totalAnalyticsUpdate: { [key: string]: number } = {
        [`overview.accounting.totalPayable`]: 0,
      };
      const userAnalyticsUpdates: any[] = [];

      for (let i = 0; i < toIncrement.ids.length; i++) {
        const followerCount = toIncrement.ids.filter(
          (id: ObjectId) => String(id) === String(toIncrement.ids[i])
        ).length;

        const amount = dailyRewardShare * followerCount;

        totalAnalyticsUpdate[`overview.accounting.totalPayable`] +=
          Number(dailyRewardShare);

        userAnalyticsUpdates.push({
          updateOne: {
            filter: {
              userId: new ObjectId(toIncrement.ids[i]),
              createdAt: now,
            },
            update: {
              $inc: {
                [`overview.accounting.totalPayable`]: dailyRewardShare,
                [`accounting.totalPayable`]: dailyRewardShare,
              },
            },
            upsert: true,
          },
        });

        bulkOperations.push({
          updateOne: {
            filter: { _id: new ObjectId(toIncrement.ids[i]) },
            update: {
              $inc: {
                "club.payouts.balance": amount,
                netBenefit: amount,
              },
            },
          },
        });

        if (bulkOperations.length >= batchSize) {
          await doWithRetries(async () =>
            db.collection("User").bulkWrite(bulkOperations)
          );

          await doWithRetries(async () =>
            db.collection("UserAnalytics").bulkWrite(userAnalyticsUpdates)
          );
          bulkOperations.length = 0;
        }
      }

      if (bulkOperations.length > 0) {
        await doWithRetries(async () =>
          db.collection("User").bulkWrite(bulkOperations)
        );

        await doWithRetries(async () =>
          db.collection("UserAnalytics").bulkWrite(bulkOperations)
        );
      }

      await doWithRetries(async () =>
        db
          .collection("TotalAnalytics")
          .updateOne({ createdAt: now }, { $set: totalAnalyticsUpdate })
      );
    }

    await addCronLog({
      functionName: "allocateDailyReward",
      isError: false,
      message: `Allocated to ${bulkOperations.length} users.`,
    });
  } catch (err) {
    await addCronLog({
      functionName: "allocateDailyReward",
      isError: true,
      message: err.message,
    });
  }
}

run()
  .then(async () => {
    await client.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await client.close();
    process.exit(1);
  });
