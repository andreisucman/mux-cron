import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";
import removeFromClub from "./functions/removeFromClub.js";
import sendEmail from "./functions/sendEmail.js";
import { daysFrom, formatDate } from "./helpers/utils.js";
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
            { projection: { "subscriptions.club": 1, email: 1 } }
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
      const { subscriptions, email } = member;
      const { club } = subscriptions;

      const firstCheckDate = daysFrom({
        date: new Date(club.validUntil),
        days: 1,
      });

      const lastCheckDate = daysFrom({
        date: new Date(club.validUntil),
        days: 7,
      });

      if (firstCheckDate > new Date()) {
        await sendEmail({
          to: email,
          from: "info@maxyouout.com",
          subject: "Your club data at MaxYouOut.com",
          text: `Hello,\n Your club subscription has expired on ${formatDate({
            date: new Date(club.validUntil),
          })}.\nWe will keep your club data until ${formatDate({
            date: lastCheckDate,
          })}. After that it will be permanently deleted and your trackers released.\nTo prevent the loss of your club data and trackers please renew your subscription.\nThank you,\nMax You Out`,
        });
      }

      if (lastCheckDate < new Date()) {
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
