import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./init.js";
import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function run() {
  try {
    const { deletedCount } = await doWithRetries({
      functionName: "cron - deleteAccounts - delete",
      functionToExecute: async () =>
        db.collection("User").deleteMany({
          deleteOn: { $lt: new Date() },
        }),
    });

    addCronLog({
      functionName: "deleteAccounts",
      message: `${deletedCount} accounts deleted`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - deleteAccounts",
      message: err.message,
    });
  }
}

run();
