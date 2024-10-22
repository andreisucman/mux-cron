import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./init.js";

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function run() {
  try {
    const { modifiedCount } = await doWithRetries({
      functionName: "cron - updateExpiredTasks - update tasks",
      functionToExecute: async () =>
        db
          .collection("User")
          .updateMany(
            { status: "active", expiresAt: { $lte: new Date() } },
            { $set: { status: "expired" } }
          ),
    });
    
    const { modifiedCount: modfiedRoutines } = await doWithRetries({
      functionName: "cron - updateExpiredTasks - update routines",
      functionToExecute: async () =>
        db
          .collection("User")
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
