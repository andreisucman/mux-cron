import * as dotenv from "dotenv";
dotenv.config();
import { client, userDb } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

const createFacet = (interval: "day" | "week" | "month") => {
  let date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  const group: Record<string, any> = {
    _id: {
      userId: "$userId",
      part: "$part",
      concern: "$concern",
      page: "$page",
    },
    views: { $sum: "$views" },
    monetization: { $first: "$monetization" },
    status: { $first: "$status" },
  };

  const projection: Record<string, any> = {
    userId: "$_id.userId",
    part: "$_id.part",
    concern: "$_id.concern",
    page: "$_id.page",
    monetization: 1,
    status: 1,
    views: 1,
    interval: 1,
    _id: 0,
  };

  switch (interval) {
    case "week":
      date.setUTCDate(date.getUTCDate() - 7);
      break;
    case "month":
      date.setUTCMonth(date.getUTCMonth() - 1);
      break;
  }

  console.log("date", interval, date);

  return [
    { $match: { createdAt: { $gte: date } } },
    { $group: group },
    {
      $addFields: {
        interval,
      },
    },
    { $project: projection },
  ] as const;
};

async function flushBatch(ops: any[], userDb: typeof import("init.js").userDb) {
  if (ops.length === 0) return;

  await doWithRetries(() =>
    userDb.collection("ViewTotal").bulkWrite(ops, { ordered: false })
  );
  ops.length = 0;
}

async function run() {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);

  const pipeline = [
    {
      $facet: {
        day: createFacet("day"),
        week: createFacet("week"),
        month: createFacet("month"),
      },
    },
    { $project: { merged: { $setUnion: ["$day", "$week", "$month"] } } },
    { $unwind: "$merged" },
    {
      $project: {
        _id: 0,
        views: { $ifNull: ["$merged.views", 0] },
        interval: "$merged.interval",
        userId: "$merged.userId",
        part: "$merged.part",
        concern: "$merged.concern",
        page: "$merged.page",
        monetization: "$merged.monetization",
        status: "$merged.status",
      },
    },
  ];

  const cursor = await doWithRetries(async () =>
    userDb
      .collection("View")
      .aggregate(pipeline, {
        allowDiskUse: true,
        cursor: { batchSize: 2_000 },
      })
      .toArray()
  );

  const BATCH_SIZE = 1_000;
  const updateBatch: any[] = [];

  try {
    for await (const doc of cursor) {
      updateBatch.push({
        updateOne: {
          filter: {
            userId: doc.userId,
            part: doc.part,
            concern: doc.concern,
            page: doc.page,
            interval: doc.interval,
          },
          update: {
            $set: {
              views: doc.views,
              updatedAt: new Date(),
              monetization: doc.monetization,
              status: doc.status,
            },
          },
          upsert: true,
        },
      });

      if (updateBatch.length >= BATCH_SIZE) {
        await flushBatch(updateBatch, userDb);
      }
    }

    await flushBatch(updateBatch, userDb);
  } catch (err: any) {
    await addCronLog({
      functionName: "aggregateViewsAndCalculateEarnings",
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
