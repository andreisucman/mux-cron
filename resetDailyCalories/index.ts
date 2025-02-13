import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    await doWithRetries(async () =>
      db.collection("User").updateMany(
        {
          $expr: {
            $let: {
              vars: {
                localTime: {
                  $dateAdd: {
                    startDate: "$$NOW",
                    unit: "minute",
                    amount: "$timeZoneOffsetInMinutes",
                  },
                },
              },
              in: {
                $and: [
                  { $eq: [{ $hour: "$$localTime" }, 0] },
                  { $gte: [{ $minute: "$$localTime" }, 0] },
                  { $lte: [{ $minute: "$$localTime" }, 10] },
                  { $gte: [{ $second: "$$localTime" }, 0] },
                  { $lte: [{ $second: "$$localTime" }, 59] },
                ],
              },
            },
          },
        },
        [
          {
            $set: {
              "nutrition.remainingDailyCalories": "$nutrition.dailyCalorieGoal",
            },
          },
        ]
      )
    );

    await addCronLog({
      functionName: "resetDailyCalories",
      message: "Completed",
      isError: false,
    });
  } catch (err) {
    await addCronLog({
      functionName: "resetDailyCalories",
      message: err.message,
      isError: true,
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
