import * as dotenv from "dotenv";
dotenv.config();

import { ObjectId } from "mongodb";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import executeInBatches from "helpers/executeInBatches.js";
import updateAnalytics from "./functions/updateAnalytics";
import { db } from "init.js";

async function run() {
  try {
    const expiredTasks = await doWithRetries(async () =>
      db
        .collection("Task")
        .aggregate([
          { $match: { status: "active", expiresAt: { $lte: new Date() } } },
          {
            $group: {
              _id: "type",
              userId: { $first: "$userId" },
              part: { $first: "$part" },
            },
          },
          { $project: { _id: 1, userId: 1, part: 1 } },
        ])
        .toArray()
    );

    const promises = [];
    const analyticsToUpdate: { [key: string]: number } = {};

    for (const task of expiredTasks) {
      const { _id: type, part, userId } = task;
      let streaksToReset: { [key: string]: number } = {};

      if (type === "head") {
        if (part === "face") {
          streaksToReset["streaks.faceStreak"] = 0;
          streaksToReset["streaks.clubFaceStreak"] = 0;
        }
        if (part === "mouth") {
          streaksToReset["streaks.mouthStreak"] = 0;
          streaksToReset["streaks.clubMouthStreak"] = 0;
        }
        if (part === "scalp") {
          streaksToReset["streaks.scalpStreak"] = 0;
          streaksToReset["streaks.clubScalpStreak"] = 0;
        }
      } else if (type === "body") {
        if (part === "body") {
          streaksToReset["streaks.bodyStreak"] = 0;
          streaksToReset["streaks.clubBodyStreak"] = 0;
        }
      } else if (type === "health") {
        if (part === "health") {
          streaksToReset["streaks.healthStreak"] = 0;
          streaksToReset["streaks.clubHealthStreak"] = 0;
        }
      }

      promises.push(
        doWithRetries(async () =>
          db.collection("User").updateOne(
            { _id: new ObjectId(userId) },
            {
              $set: streaksToReset,
            }
          )
        )
      );

      const taskGeneralKey = `overview.usage.tasks.tasksExpired`;
      const taskPartKey = `overview.usage.tasks.part.tasksExpired.${part}`;

      if (analyticsToUpdate[taskGeneralKey]) {
        analyticsToUpdate[taskGeneralKey] += 1;
      } else {
        analyticsToUpdate[taskGeneralKey] = 1;
      }

      if (analyticsToUpdate[taskPartKey]) {
        analyticsToUpdate[taskPartKey] += 1;
      } else {
        analyticsToUpdate[taskPartKey] = 1;
      }
    }

    updateAnalytics(analyticsToUpdate);

    await executeInBatches({ promises, batchSize: 50 });

    const { modifiedCount } = await doWithRetries(async () =>
      db
        .collection("Task")
        .updateMany(
          { status: "active", expiresAt: { $lte: new Date() } },
          { $set: { status: "expired" } }
        )
    );

    const { modifiedCount: modfiedRoutines } = await doWithRetries(async () =>
      db
        .collection("Routine")
        .updateMany(
          { status: "active", lastDate: { $lte: new Date() } },
          { $set: { status: "inactive" } }
        )
    );

    addCronLog({
      functionName: "updateExpiredTasks",
      isError: false,
      message: `${modifiedCount} tasks and ${modfiedRoutines} routines inactivated`,
    });
  } catch (err) {
    addCronLog({
      functionName: "updateExpiredTasks",
      isError: true,
      message: err.message,
    });
  }
}

run();
