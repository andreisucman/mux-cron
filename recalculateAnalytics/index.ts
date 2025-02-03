import * as dotenv from "dotenv";
dotenv.config();

import { adminDb } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import getActiveTodayUsersCount from "./functions/getActiveTodayUsersCount.js";
import addCronLog from "helpers/addCronLog.js";
import setUtcMidnight from "./helpers/setUtcMidnight.js";
import getAveragesPerUser from "./functions/getAveragesPerUser.js";

async function run() {
  try {
    const createdAt = setUtcMidnight({ date: new Date() });

    const activeTodayUsersCount = await getActiveTodayUsersCount({
      date: new Date(),
    });

    const response = await getAveragesPerUser();

    if (!response) return;

    const { avgCost, avgRevenue, avgReward, netCash, netRevenue } = response;

    const setPayload = {
      "overview.user.activeTodayUsers": activeTodayUsersCount,
      "overview.user.averageRevenuePerUser": avgRevenue,
      "overview.user.averageCostPerUser": avgCost,
      "overview.user.averageRewardPerUser": avgReward,
      "overview.accounting.netRevenue": netRevenue,
      "overview.accounting.netCash": netCash,
    };

    await doWithRetries(async () =>
      adminDb.collection("TotalAnalytics").updateOne(
        { createdAt },
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
