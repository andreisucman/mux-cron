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

    const { avgCost, avgReward } = (await getAveragesPerUser()) || {};

    const setPayload = {
      "overview.user.user.count.blockedUsers": suspendedUsers,
      "overview.user.user.count.suspendedUsers": blockedUsers,
      "overview.user.user.count.activeUsers": usersActiveOnThatDate,
      "overview.user.user.averageCostPerUser": avgCost || 0,
      "overview.user.user.averageRewardPerUser": avgReward || 0,
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
