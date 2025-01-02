import * as dotenv from "dotenv";
dotenv.config();

import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const { deletedCount } = await doWithRetries(async () =>
      db.collection("User").deleteMany({
        deleteOn: { $lte: new Date() },
      })
    );

    addCronLog({
      functionName: "deleteAccounts",
      isError: false,
      message: `${deletedCount} accounts deleted`,
    });
  } catch (err) {
    addCronLog({
      functionName: "deleteAccounts",
      isError: true,
      message: err.message,
    });
  }
}

run();
