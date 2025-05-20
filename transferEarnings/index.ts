import addCronLog from "./helpers/addCronLog.js";
import { client, stripe, userDb } from "./init.js";
import doWithRetries from "./helpers/doWithRetries.js";
import { checkIfDeductedThisMonth } from "./helpers/utils.js";

async function run() {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);

  const payPerMilleRaw = Number(process.env.PAY_PER_MILLE ?? 0);
  if (!Number.isFinite(payPerMilleRaw) || payPerMilleRaw <= 0) {
    throw new Error("PAY_PER_MILLE env var missing or invalid");
  }
  const payPerView = payPerMilleRaw / 1000;

  const viewQuery = {
    createdAt: { $gte: midnight },
    views: { $gt: 0 },
    monetization: "enabled",
    interval: "day",
    added: { $ne: true },
  };

  const projection = { userId: 1, views: 1 };

  const viewCursor = userDb.collection("ViewTotal").find(viewQuery, {
    projection,
    batchSize: 1_000,
  });

  const balanceBatch = [];
  const affectedUserIds = new Set();
  const balanceBatchSize = 1_000;

  for await (const { userId, views } of viewCursor) {
    balanceBatch.push({
      updateOne: {
        filter: { _id: userId },
        update: { $inc: { "club.payouts.balance": views * payPerView } },
      },
    });
    affectedUserIds.add(userId);

    if (balanceBatch.length >= balanceBatchSize) {
      await doWithRetries(() =>
        userDb.collection("User").bulkWrite(balanceBatch, { ordered: false })
      );
      balanceBatch.length = 0;
    }
  }

  if (balanceBatch.length) {
    await doWithRetries(() =>
      userDb.collection("User").bulkWrite(balanceBatch, { ordered: false })
    );
  }

  if (affectedUserIds.size) {
    await doWithRetries(() =>
      userDb.collection("ViewTotal").updateMany(
        {
          createdAt: { $gte: midnight },
          userId: { $in: [...affectedUserIds] },
        },
        { $set: { added: true } }
      )
    );
  }

  const eligibleCursor = userDb.collection("User").find(
    {
      $expr: {
        $and: [
          { $gte: ["$club.payouts.balance", "$club.payouts.minPayoutAmount"] },
          { $gt: ["$club.payouts.balance", 0] },
        ],
      },
    },
    {
      projection: {
        "club.payouts.connectId": 1,
        "club.payouts.balance": 1,
        "club.payouts.lastPayoutDate": 1,
      },
      batchSize: 500,
    }
  );

  const concurrentTransfers = 25;
  let taskBatch = [];

  for await (const user of eligibleCursor) {
    const { balance, lastPayoutDate, connectId } = user.club.payouts;

    const deductedThisMonth = checkIfDeductedThisMonth(
      lastPayoutDate,
      new Date()
    );
    const netBalance = deductedThisMonth ? balance : balance - 2; // $2 fee once/month
    if (netBalance <= 0) continue;

    const amountCents = Math.floor(netBalance * 100); 

    const task = doWithRetries(async () => {
      await stripe.transfers.create(
        {
          amount: amountCents,
          currency: "usd",
          destination: connectId,
          metadata: { source: "cron.transferEarnings" },
        },
        {
          idempotencyKey: `transfer-${user._id}-${new Date()
            .toISOString()
            .slice(0, 7)}`, // 2025-05
        }
      );

      await userDb.collection("User").updateOne(
        { _id: user._id },
        {
          $inc: { "club.payouts.balance": -netBalance },
          $set: { "club.payouts.lastPayoutDate": new Date() },
        }
      );
    });

    taskBatch.push(task);

    if (taskBatch.length >= concurrentTransfers) {
      await Promise.allSettled(taskBatch);
      taskBatch = [];
    }
  }

  if (taskBatch.length) await Promise.allSettled(taskBatch);
}

run()
  .then(() => client.close())
  .catch(async (err) => {
    console.error(err);
    await addCronLog({
      functionName: "transferEarnings",
      isError: true,
      message: err.message,
    });
    await client.close();
    process.exit(1);
  });
