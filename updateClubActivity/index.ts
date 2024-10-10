import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./init.js";

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";

async function run() {
  try {
    const expiredClubMembers = await doWithRetries({
      functionName: "cron - updateClubActivity - find",
      functionToExecute: async () =>
        db
          .collection("User")
          .find({
            "club.isActive": true,
            "subscriptions.club.validUntil": { $lte: new Date() },
          })
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
