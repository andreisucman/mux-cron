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
              _id: "part",
              userId: { $first: "$userId" },
              type: { $first: "$type" },
              part: { $first: "$part" },
            },
          },
          { $project: { _id: 1, userId: 1, type: 1, part: 1 } },
        ])
        .toArray()
    );

    const analyticsToUpdate: { [key: string]: number } = {};

    for (const task of expiredTasks) {
      const taskGeneralKey = `overview.usage.tasks.tasksExpired`;
      const taskPartKey = `overview.usage.tasks.part.tasksExpired.${task.part}`;

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

    const uniqueUserIds = [
      ...new Set(expiredTasks.map((t) => String(t.userId))),
    ];
    const usersToReset = [];

    for (const id of uniqueUserIds) {
      const relatedTasks = expiredTasks.filter((t) => t.userId === id);

      const resetRecord: { [key: string]: number } = {};

      for (const task of relatedTasks) {
        const { _id: part, type } = task;

        if (type === "head") {
          if (part === "face") {
            resetRecord["streaks.faceStreak"] = 0;
            resetRecord["streaks.clubFaceStreak"] = 0;
          }
          if (part === "mouth") {
            resetRecord["streaks.mouthStreak"] = 0;
            resetRecord["streaks.clubMouthStreak"] = 0;
          }
          if (part === "scalp") {
            resetRecord["streaks.scalpStreak"] = 0;
            resetRecord["streaks.clubScalpStreak"] = 0;
          }
        } else if (type === "body") {
          if (part === "body") {
            resetRecord["streaks.bodyStreak"] = 0;
            resetRecord["streaks.clubBodyStreak"] = 0;
          }
        } else if (type === "health") {
          if (part === "health") {
            resetRecord["streaks.healthStreak"] = 0;
            resetRecord["streaks.clubHealthStreak"] = 0;
          }
        }
      }

      usersToReset.push({
        updateOne: {
          filter: { _id: new ObjectId(id) },
          update: { $set: resetRecord },
        },
      });
    }

    const bulkOperations: any[] = [];
    const batchSize = 500;

    for (let i = 0; i < usersToReset.length; i++) {
      bulkOperations.push(usersToReset[i]);

      if (bulkOperations.length >= batchSize) {
        await doWithRetries(async () =>
          db.collection("User").bulkWrite(bulkOperations)
        );
        bulkOperations.length = 0;
      }
    }

    if (bulkOperations.length > 0) {
      await doWithRetries(async () =>
        db.collection("User").bulkWrite(bulkOperations)
      );
    }

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

    updateAnalytics({ incrementPayload: analyticsToUpdate });

    addCronLog({
      functionName: "updateExpiredTasksAndRoutine",
      isError: false,
      message: `${modifiedCount} tasks and ${modfiedRoutines} routines inactivated`,
    });
  } catch (err) {
    addCronLog({
      functionName: "updateExpiredTasksAndRoutine",
      isError: true,
      message: err.message,
    });
  }
}

run();
