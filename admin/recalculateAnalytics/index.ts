import * as dotenv from "dotenv";
dotenv.config();

import pLimit from "p-limit";
import { adminDb } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import getActiveTodayUsersCount from "./functions/getActiveTodayUsersCount";
import addCronLog from "helpers/addCronLog.js";
import getAveragesPerUser from "./functions/getAveragesPerUser";

const limit = pLimit(10);

async function run() {
  try {
    const today = new Date().toDateString();

    const activeTodayUsersCount = await getActiveTodayUsersCount({
      date: new Date(),
    });

    const { avgCost, avgRevenue, avgReward, netCash, netRevenue } =
      await getAveragesPerUser();

    const setPayload = {
      "dashboard.user.activeTodayUsers": activeTodayUsersCount,
      "dashboard.user.averageRevenuePerUser": avgRevenue,
      "dashboard.user.averageCostPerUser": avgCost,
      "dashboard.user.averageRewardPerUser": avgReward,
      "dashboard.accounting.netRevenue": netRevenue,
      "dashboard.accounting.netCash": netCash,
    };

    await doWithRetries(async () =>
      adminDb.collection("TotalAnalytics").updateOne(
        { createdAt: today },
        {
          $set: setPayload,
        },
        {
          upsert: true,
        }
      )
    );

    addCronLog({
      functionName: "updateAnalytics",
      isError: false,
      message: "Analytics updated",
    });
  } catch (err) {
    addCronLog({
      functionName: "updateAnalytics",
      isError: true,
      message: err.message,
    });
  }
}

run();
