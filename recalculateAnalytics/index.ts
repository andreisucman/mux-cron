import * as dotenv from "dotenv";
dotenv.config();

import { adminDb } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import getActiveTodayUsersCount from "./functions/getActiveTodayUsersCount";
import addCronLog from "helpers/addCronLog.js";
import setUtcMidnight from "./helpers/setUtcMidnight";
import getAveragesPerUser from "./functions/getAveragesPerUser";

async function run() {
  try {
    const createdAt = setUtcMidnight({ date: new Date() });

    const activeTodayUsersCount = await getActiveTodayUsersCount({
      date: new Date(),
    });

    const { avgCost, avgRevenue, avgReward, netCash, netRevenue } =
      await getAveragesPerUser();

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
