import * as dotenv from "dotenv";
dotenv.config();

import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const { deletedCount } = await doWithRetries(async () =>
      db.collection("User").deleteMany({
        deleteOn: { $lt: new Date() },
      })
    );

    addCronLog({
      functionName: "cron - deleteAccounts",
      isError: false,
      message: `${deletedCount} accounts deleted`,
    });
  } catch (err) {
    addCronLog({
      functionName: "cron - deleteAccounts",
      isError: true,
      message: err.message,
    });
  }
}

run();
