import * as dotenv from "dotenv";
dotenv.config();

import { client, stripe, userDb } from "init.js";
import addCronLog from "helpers/addCronLog.js";
import doWithRetries from "./helpers/doWithRetries.js";
import formatAmountForStripe from "./helpers/formatAmountForStripe.js";

async function run() {
  try {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const todaysEarners = await doWithRetries(() =>
      userDb
        .collection("ViewTotal")
        .aggregate([
          {
            $match: {
              updatedAt: { $gte: midnight, earnedDay: { $exists: true } },
            },
          },
          {
            $group: {
              _id: "$connectId",
              totalEarnedDay: { $sum: "$earnedDay" },
            },
            connectId: { $first: "$connectId" },
          },
          { projection: { totalEarnedDay: 1, connectId: 1, _id: 0 } },
        ])
        .toArray()
    );

    const batchSize = 50;
    let transfers = [];
    for (const earner of todaysEarners) {
      transfers.push(
        doWithRetries(() =>
          stripe.transfers.create({
            amount: formatAmountForStripe(earner.totalEarnedDay, "usd"),
            currency: "usd",
            destination: earner.connectId,
          })
        )
      );

      if (transfers.length === batchSize) {
        await Promise.allSettled(transfers);
        transfers = [];
      }
    }
    if (transfers.length > 0) {
      await Promise.allSettled(transfers);
      transfers = [];
    }
    
  } catch (err) {
    await addCronLog({
      functionName: "transferEarningsFromViews",
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
