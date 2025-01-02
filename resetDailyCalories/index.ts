import * as dotenv from "dotenv";
dotenv.config();

import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    await doWithRetries(async () =>
      db.collection("User").updateMany({}, [
        {
          $addFields: {
            localTime: {
              $dateAdd: {
                startDate: new Date(),
                unit: "minute",
                amount: "$timeZoneOffsetInMinutes",
              },
            },
          },
        },
        {
          $project: {
            localHour: { $hour: "$localTime" },
            localMinute: { $minute: "$localTime" },
            localSecond: { $second: "$localTime" },
            _id: 1,
          },
        },
        {
          $match: {
            localHour: 0,
            localMinute: { $gte: 0, $lte: 10 },
            localSecond: { $gte: 0, $lte: 59 },
          },
        },
        {
          $set: {
            "nutrition.remainingDailyCalories": "$nutrition.dailyCalorieGoal",
          },
        },
      ])
    );

    addCronLog({
      functionName: "resetDailyCalories",
      message: "Completed",
      isError: false,
    });
  } catch (err) {
    addCronLog({
      functionName: "resetDailyCalories",
      message: err.message,
      isError: true,
    });
  }
}

run();
