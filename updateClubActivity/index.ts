import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";
import removeFromClub from "./functions/removeFromClub.js";
import { daysFrom } from "./helpers/utils.js";
import { db } from "./init.js";

async function run() {
  try {
    const expiredClubMembers = await doWithRetries({
      functionName: "cron - updateClubActivity - find",
      functionToExecute: async () =>
        db
          .collection("User")
          .find(
            {
              "club.isActive": true,
              "subscriptions.club.validUntil": { $lte: new Date() },
            },
            { projection: { "subscriptions.club": 1 } }
          )
          .toArray(),
    });

    if (expiredClubMembers.length === 0) return;

    const { modifiedCount } = await doWithRetries({
      functionName: "cron - updateClubActivity - update",
      functionToExecute: async () =>
        db.collection("User").updateMany(
          {
            "club.isActive": true,
            "subscriptions.club.validUntil": { $lte: new Date() },
          },
          { $set: { "club.isActive": false } }
        ),
    });

    for (const member of expiredClubMembers) {
      const { subscriptions } = member;
      const { club } = subscriptions;

      const checkDate = daysFrom({ date: new Date(club.validUntil), days: 7 });

      if (checkDate < new Date()) {
        await removeFromClub({ userId: String(member._id) });
      }
    }

    addCronLog({
      functionName: "updateClubActivity",
      message: `${modifiedCount} records updated`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - updateClubActivity",
      message: err.message,
    });
  }
}

run();
