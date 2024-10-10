import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./init.js";

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function run() {
  try {
    const { modifiedCount } = await doWithRetries({
      functionName: "cron - updateExpiredTasks - find",
      functionToExecute: async () =>
        db
          .collection("User")
          .updateMany(
            { status: "active", expiresAt: { $lte: new Date() } },
            { $set: { status: "expired" } }
          ),
    });
    addCronLog({
      functionName: "updateExpiredTasks",
      message: `${modifiedCount} tasks updated`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - updateExpiredTasks",
      message: err.message,
    });
  }
}

run();
