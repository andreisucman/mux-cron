import * as dotenv from "dotenv";
dotenv.config();

import { ObjectId } from "mongodb";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import updateAnalytics from "./functions/updateAnalytics.js";
import { db, client } from "init.js";

async function run() {
  try {
    const expiredTaskPartGroups = await doWithRetries(async () =>
      db
        .collection("Task")
        .aggregate([
          {
            $match: {
              status: { $in: ["active", "canceled"] },
              expiresAt: { $lte: new Date() },
            },
          },
          {
            $group: {
              _id: "part",
              userId: { $first: "$userId" },
              part: { $first: "$part" },
            },
          },
          { $project: { _id: 1, userId: 1, status: 1, part: 1, isCreated: 1 } },
        ])
        .toArray()
    );

    const analyticsToUpdate: { [key: string]: number } = {};

    const addParamsToAnalytics = (key: string) => {
      analyticsToUpdate[key] = (analyticsToUpdate[key] || 0) + 1;
    };

    for (const task of expiredTaskPartGroups) {
      if (task.status === "active") {
        const taskGeneralKey = `overview.user.usage.tasks.tasksExpired`;
        const taskPartKey = `overview.user.usage.tasks.part.tasksExpired.${task.part}`;

        addParamsToAnalytics(taskGeneralKey);
        addParamsToAnalytics(taskPartKey);

        if (task.isCreated) {
          const manualTaskGeneralKey = `overview.user.usage.tasks.manualTasksExpired`;
          const manualTaskPartKey = `overview.user.usage.tasks.part.manualTasksExpired.${task.part}`;

          addParamsToAnalytics(manualTaskGeneralKey);
          addParamsToAnalytics(manualTaskPartKey);
        }
      }
    }

    const expiredTasks = await doWithRetries(async () =>
      db
        .collection("Task")
        .find(
          {
            status: { $in: ["active", "canceled"] },
            expiresAt: { $lte: new Date() },
          },
          {
            projection: {
              _id: 1,
              userId: 1,
              part: 1,
            },
          }
        )
        .toArray()
    );

    const uniqueUserIds = [...new Set(expiredTasks.map((t) => String(t.userId)))];

    let updateUserOps = [];
    const batchSize = 500;

    for (const userId of uniqueUserIds) {
      const relatedTasks = expiredTasks.filter((t) => String(t.userId) === userId);

      const resetRecord: { [key: string]: number } = {};

      for (const task of relatedTasks) {
        const { part } = task;

        if (part === "face") {
          resetRecord["streaks.faceStreak"] = 0;
        }
        if (part === "scalp") {
          resetRecord["streaks.hairStreak"] = 0;
        }
      }

      updateUserOps.push({
        updateOne: {
          filter: { _id: new ObjectId(userId) },
          update: { $set: resetRecord },
        },
      });

      if (updateUserOps.length >= batchSize) {
        await doWithRetries(async () => db.collection("User").bulkWrite(updateUserOps));
        updateUserOps.length = 0;
      }
    }

    if (updateUserOps.length > 0) {
      await doWithRetries(async () => db.collection("User").bulkWrite(updateUserOps));
      updateUserOps.length = 0;
    }

    const { modifiedCount } = await doWithRetries(async () =>
      db.collection("Task").updateMany(
        {
          status: "active",
          expiresAt: { $lte: new Date() },
        },
        { $set: { status: "expired" } }
      )
    );

    const routineUpdateOps: any[] = expiredTasks.map((obj) => ({
      updateOne: {
        filter: {
          "allTasks.ids._id": obj._id,
        },
        update: {
          $set: {
            "allTasks.$.ids.$[element].status": "expired",
          },
        },
        arrayFilters: [{ "element._id": obj._id }],
      },
    }));

    if (routineUpdateOps.length > 0)
      await doWithRetries(async () => db.collection("Routine").bulkWrite(routineUpdateOps));

    const { modifiedCount: modfiedRoutines } = await doWithRetries(async () =>
      db.collection("Routine").updateMany(
        {
          status: "active",
          "allTasks.ids": {
            $not: { $elemMatch: { status: "active" } },
          },
        },
        { $set: { status: "inactive" } }
      )
    );

    updateAnalytics({ incrementPayload: analyticsToUpdate });

    await addCronLog({
      functionName: "updateExpiredTasksAndRoutine",
      isError: false,
      message: `${modifiedCount} tasks and ${modfiedRoutines} routines inactivated`,
    });
  } catch (err) {
    await addCronLog({
      functionName: "updateExpiredTasksAndRoutine",
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
