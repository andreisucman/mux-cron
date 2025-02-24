import * as dotenv from "dotenv";
dotenv.config();

import { adminDb, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import getActiveUsersCount from "./functions/getUsersStats.js";
import addCronLog from "helpers/addCronLog.js";
import { setToUtcMidnight } from "./helpers/utils.js";
import getAveragesPerUser from "./functions/getAveragesPerUser.js";

async function run() {
  try {
    const createdAt = setToUtcMidnight(new Date());

    const {
      usersActiveOnThatDate = 0,
      blockedUsers = 0,
      suspendedUsers = 0,
    } = await getActiveUsersCount({
      date: new Date(),
    });

    const {
      avgCost = 0,
      avgRevenue = 0,
      avgReward = 0,
      netCash = 0,
      netRevenue = 0,
    } = await getAveragesPerUser();

    const setPayload = {
      "overview.user.count.blockedUsers": suspendedUsers,
      "overview.user.count.suspendedUsers": blockedUsers,
      "overview.user.count.activeTodayUsers": usersActiveOnThatDate,
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

    await addCronLog({
      functionName: "updateAnalytics",
      isError: false,
      message: "Analytics updated",
    });
  } catch (err) {
    await addCronLog({
      functionName: "updateAnalytics",
      isError: true,
      message: err.message,
    });
  }
}

run()
  .then(async () => {
    await client.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await client.close();
    process.exit(1);
  });
