import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const dayOfMonth = new Date().getDate();
    if (dayOfMonth % 7 !== 0) return;

    await doWithRetries(async () =>
      fetch(`${process.env.SERVER_URL!}/findProductsForGeneralTasks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.API_KEY!}`,
        },
      })
    );

    addCronLog({
      functionName: "findProductsForGeneralTasks",
      message: "Completed",
      isError: false,
    });
  } catch (err) {
    addCronLog({
      functionName: "findProductsForGeneralTasks",
      message: err.message,
      isError: true,
    });
  }
}

run();
