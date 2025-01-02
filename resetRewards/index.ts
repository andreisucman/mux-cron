import * as dotenv from "dotenv";
dotenv.config();

import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import { daysFrom, getDaysUntilNextMonth } from "./helpers/utils";

async function run() {
  try {
    const daysUntilNextMonth = getDaysUntilNextMonth();

    await doWithRetries(async () =>
      db.collection("User").updateMany({}, [
        {
          $match: {
            renewsOn: { $lt: new Date() },
          },
        },
        {
          $set: {
            left: "$count",
            renewsOn: daysFrom({ days: daysUntilNextMonth }),
          },
        },
      ])
    );

    addCronLog({
      functionName: "renewRewards",
      message: "Completed",
      isError: false,
    });
  } catch (err) {
    addCronLog({
      functionName: "renewRewards",
      message: err.message,
      isError: true,
    });
  }
}

run();
