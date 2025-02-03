import * as dotenv from "dotenv";
dotenv.config();

import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  const maximumEnergy = Number(process.env.MAXIMUM_COACH_ENERGY);
  const hourly = maximumEnergy / 24;

  try {
    await doWithRetries(async () =>
      db.collection("User").updateMany(
        {
          coachEnergy: { $lt: maximumEnergy },
        },
        [
          {
            $set: {
              coachEnergy: {
                $cond: {
                  if: {
                    $lt: [{ $add: ["$coachEnergy", hourly] }, maximumEnergy],
                  },
                  then: { $add: ["$coachEnergy", hourly] },
                  else: maximumEnergy,
                },
              },
            },
          },
        ]
      )
    );

    addCronLog({
      functionName: "increaseCoachEnergy",
      message: "Completed",
      isError: false,
    });
  } catch (err) {
    addCronLog({
      functionName: "increaseCoachEnergy",
      message: err.message,
      isError: true,
    });
  }
}

run();
