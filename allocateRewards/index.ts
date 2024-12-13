import * as dotenv from "dotenv";
dotenv.config();

import { ObjectId } from "mongodb";
import { db, stripe } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import { getTotalDaysInCurrentMonth, getIsToday } from "./helpers/utils";
import pLimit from "p-limit";

const limit = pLimit(10);

async function handleAllocateReward(
  skip: number,
  batchSize: number,
  dailyRewardShare: number
) {
  try {
    const updateOps: any = [];

    const users = await doWithRetries(() =>
      db
        .collection("User")
        .find(
          { "subscriptions.peek.validUntil": { $gt: new Date() } },
          { projection: { "club.followingUserId": 1 } }
        )
        .skip(skip)
        .limit(batchSize)
        .toArray()
    );

    for (const user of users) {
      const { club } = user;
      const { followingUserId } = club;

      if (followingUserId) {
        const updateOp = {
          updateOne: {
            filter: {
              _id: new ObjectId(followingUserId),
            },
            update: { $inc: { "club.payouts.rewardEarned": dailyRewardShare } },
          },
        };
        updateOps.push(updateOp);
      }
    }

    if (updateOps.length > 0) {
      await doWithRetries(async () => {
        await db.collection("User").bulkWrite(updateOps);
      });
    }
  } catch (err) {
    addCronLog({
      functionName: "handleAllocateReward",
      isError: true,
      message: err,
    });
    throw err;
  }
}

async function run() {
  try {
    const latestAllocation = (await doWithRetries(async () =>
      db
        .collection("RewardAllocation")
        .find({}, { projection: { createdAt: 1 } })
        .sort({ createdAt: -1 })
        .next()
    )) as unknown as { createdAt: Date | null };

    const { createdAt } = latestAllocation || {};

    const isToday = getIsToday(createdAt);

    if (isToday) return;

    let operationsCount = await doWithRetries(async () =>
      db.collection("User").countDocuments({
        "subscriptions.peek.validUntil": { $gt: new Date() },
      })
    );

    if (operationsCount === 0) return;

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

    const batchSize = 100;
    const batches = Math.max(Math.round(operationsCount / batchSize), 1);

    const promises = [];

    for (let i = 0; i < batches; i++) {
      const skip = i * batchSize;
      promises.push(
        limit(() => handleAllocateReward(skip, batchSize, dailyRewardShare))
      );
    }

    const response = await Promise.allSettled(promises);

    const results = response.reduce(
      (a, c) => {
        a[c.status] += 1;
        return a;
      },
      { fulfilled: 0, rejected: 0 }
    );

    await doWithRetries(async () =>
      db.collection("RewardAllocation").insertOne({
        createdAt: new Date(),
        updated: results.fulfilled,
        rejected: results.rejected,
      })
    );

    addCronLog({
      functionName: "allocateRewards",
      isError: false,
      message: `${results.fulfilled} accounts updated and ${results.rejected} failed.`,
    });
  } catch (err) {
    addCronLog({
      functionName: "allocateRewards",
      isError: true,
      message: err.message,
    });
  }
}

run();
