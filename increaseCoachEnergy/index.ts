import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./init.js";
import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function run() {
  const maximumEnergy = Number(process.env.MAXIMUM_COACH_ENERGY);
  const hourly = maximumEnergy / 24;

  try {
    const allUnderMaxEnergy = await doWithRetries({
      functionName: "cron - increaseCoachEnergy - find all under max energy",
      functionToExecute: async () =>
        db
          .collection("User")
          .find(
            {
              coachEnergy: { $lt: maximumEnergy },
            },
            { projection: { coachEnergy: 1 } }
          )
          .limit(10000)
          .toArray(),
    });

    const toUpdate = allUnderMaxEnergy.map((item) => {
      const payload = {} as { coachEnergy: number };

      if (item.coachEnergy + hourly > maximumEnergy) {
        payload.coachEnergy = maximumEnergy;
      } else {
        payload.coachEnergy = item.coachEnergy + hourly;
      }

      return {
        updateOne: {
          filter: {
            coachEnergy: { $lt: maximumEnergy },
          },
          update: payload,
        },
      };
    });

    await doWithRetries({
      functionName: "cron - increaseCoachEnergy - update maximum coach energy",
      functionToExecute: () => db.collection("User").bulkWrite(toUpdate),
    });

    addCronLog({
      functionName: "increaseCoachEnergy",
      message: `Completed`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - increaseCoachEnergy",
      message: err.message,
    });
  }
}

run();
