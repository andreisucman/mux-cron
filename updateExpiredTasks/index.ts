import { ObjectId } from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";
import executeInBatches from "./helpers/executeInBatches.js";
import { db } from "./init.js";

async function run() {
  try {
    const expiredTasks = await doWithRetries({
      functionName: "cron - updateExpiredTasks - get expired tasks",
      functionToExecute: async () =>
        db
          .collection("Task")
          .aggregate([
            { $match: { status: "active", expiresAt: { $lte: new Date() } } },
            {
              $group: {
                _id: "type",
                userId: { $first: "$userId" },
              },
            },
            { $project: { _id: 1, userId: 1 } },
          ])
          .toArray(),
    });

    const promises = [];

    for (const task of expiredTasks) {
      const { _id: type, userId } = task;
      let streaksToReset: { [key: string]: number } = {};

      if (type === "face") {
        streaksToReset["streaks.faceStreak"] = 0;
        streaksToReset["streaks.clubFaceStreak"] = 0;
      } else if (type === "body") {
        streaksToReset["streaks.bodyStreak"] = 0;
        streaksToReset["streaks.clubBodyStreak"] = 0;
      } else if (type === "health") {
        streaksToReset["streaks.healthStreak"] = 0;
        streaksToReset["streaks.clubHealthStreak"] = 0;
      }

      promises.push(
        doWithRetries({
          functionName: "uploadProof - update streaks",
          functionToExecute: async () =>
            db.collection("User").updateOne(
              { _id: new ObjectId(userId) },
              {
                $set: streaksToReset,
              }
            ),
        })
      );
    }

    await executeInBatches({ promises, batchSize: 50 });

    const { modifiedCount } = await doWithRetries({
      functionName: "cron - updateExpiredTasks - update tasks",
      functionToExecute: async () =>
        db
          .collection("Task")
          .updateMany(
            { status: "active", expiresAt: { $lte: new Date() } },
            { $set: { status: "expired" } }
          ),
    });

    const { modifiedCount: modfiedRoutines } = await doWithRetries({
      functionName: "cron - updateExpiredTasks - update routines",
      functionToExecute: async () =>
        db
          .collection("Routine")
          .updateMany(
            { status: "active", lastDate: { $lte: new Date() } },
            { $set: { status: "inactive" } }
          ),
    });

    addCronLog({
      functionName: "updateExpiredTasks",
      message: `${modifiedCount} tasks and ${modfiedRoutines} routines inactivated`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - updateExpiredTasks",
      message: err.message,
    });
  }
}

run();
