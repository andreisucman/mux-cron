import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function run() {
  try {
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth % 7 !== 0) return;
    /* get all solutions */
    await doWithRetries({
      functionName: "cron - findProductsForGeneralTasks - fetch",
      functionToExecute: async () =>
        fetch(`${process.env.SERVER_URL!}/findProductsForGeneralTasks`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.API_KEY!}`,
          },
        }),
    });

    addCronLog({
      functionName: "findProductsForGeneralTasks",
      message: "Completed",
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - findProductsForGeneralTasks",
      message: err.message,
    });
  }
}

run();
