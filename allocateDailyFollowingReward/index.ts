import * as dotenv from "dotenv";
dotenv.config();

import { db, adminDb, stripe } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import { getTotalDaysInCurrentMonth, getIsToday } from "./helpers/utils";

async function run() {
  try {
    const latestAllocation = (await doWithRetries(async () =>
      adminDb
        .collection("Cron")
        .find(
          { functionName: "allocateDailyFollowingReward", isError: false },
          { projection: { createdAt: 1 } }
        )
        .sort({ createdAt: -1 })
        .next()
    )) as unknown as { createdAt: Date | null };

    const { createdAt } = latestAllocation || {};

    const isToday = getIsToday(createdAt);

    if (createdAt && isToday) return;

    const peekPlanInfo = await doWithRetries(async () =>
      db
        .collection("Plan")
        .findOne({ name: "peek" }, { projection: { priceId: 1 } })
    );

    const { priceId } = peekPlanInfo;

    const stripePeekPriceObject = await stripe.prices.retrieve(priceId);
    const price = stripePeekPriceObject.unit_amount / 100;

    const totalDaysInCurrentMonth = getTotalDaysInCurrentMonth();
    const dailyRewardShare = price / totalDaysInCurrentMonth;

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

    if (toIncrement.ids.length === 0) return;

    const { modifiedCount } = await doWithRetries(async () =>
      db
        .collection("User")
        .updateMany(
          { _id: { $in: toIncrement.ids } },
          { $inc: { "club.payouts.balance": dailyRewardShare } }
        )
    );

    addCronLog({
      functionName: "allocateDailyFollowingReward",
      isError: false,
      message: `Allocated to ${modifiedCount} users.`,
    });
  } catch (err) {
    addCronLog({
      functionName: "allocateDailyFollowingReward",
      isError: true,
      message: err.message,
    });
  }
}

run();
