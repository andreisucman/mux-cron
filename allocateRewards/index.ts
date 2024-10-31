import { ObjectId } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./init.js";

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function handleAllocateReward(skip: number) {
  try {
    const bulkOps: any = [];

    const users = await doWithRetries({
      functionName: "handleAllocateReward - find",
      functionToExecute: async () =>
        db
          .collection("User")
          .find(
            { "subscriptions.peek.validUntil": { $gt: new Date() } },
            { projection: { "club.payouts": 1, "club.trackedUserId": 1 } }
          )
          .skip(skip)
          .limit(skip)
          .toArray(),
    });

    for (const user of users) {
      const { club } = user;
      const { payouts, trackedUserId } = club;
      const { oneShareAmount, rewardFund } = payouts;

      if (rewardFund - oneShareAmount > 0) {
        const updateTracking = {
          updateOne: {
            filter: { _id: new ObjectId(trackedUserId), "club.isActive": true },
            update: { $inc: { "club.payouts.rewardEarned": oneShareAmount } },
          },
        };

        const updateTracker = {
          updateOne: {
            filter: { _id: new ObjectId(user._id) },
            update: {
              $inc: { "club.payouts.rewardEarned": oneShareAmount * -1 },
            },
          },
        };

        bulkOps.push(updateTracking, updateTracker);
      }
    }

    await doWithRetries({
      functionName: "handleAllocateReward - bulkOps",
      functionToExecute: async () => db.collection("User").bulkWrite(bulkOps),
    });
  } catch (err) {
    addErrorLog({ functionName: "handleAllocateReward", message: err });
    throw err;
  }
}

async function run() {
  try {
    let operationsCount = await doWithRetries({
      functionName: "cron - allocateRewards",
      functionToExecute: async () =>
        db.collection("User").countDocuments({ "club.isActive": true }),
    });

    const batchSize = 100;
    const batches = Math.max(Math.round(operationsCount / batchSize), 1);
    const promises = [];

    for (let i = 0; i < batches; i++) {
      promises.push(handleAllocateReward(batchSize));
    }

    const response = await Promise.allSettled(promises);

    const results = response.reduce(
      (a, c) => {
        a[c.status] += 1;
        return a;
      },
      { fulfilled: 0, rejected: 0 }
    );

    addCronLog({
      functionName: "allocateRewards",
      message: `${results.fulfilled} accounts updated and ${results.rejected} failed.`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - allocateRewards",
      message: err.message,
    });
  }
}

run();
