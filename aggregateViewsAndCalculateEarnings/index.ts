import * as dotenv from "dotenv";
dotenv.config();

import { client, userDb } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import { daysFrom } from "./helpers/utils.js";

const createFacet = (interval: "day" | "week" | "month") => {
  let date = new Date();
  date.setHours(0, 0, 0, 0);

  const group: { [key: string]: any } = {
    _id: {
      userId: "$userId",
      part: "$part",
      concern: "$concern",
      page: "$page",
    },
  };

  const projection: { [key: string]: any } = {
    userId: "$_id.userId",
    part: "$_id.part",
    concern: "$_id.concern",
    page: "$_id.page",
    userName: 1,
    _id: 0,
  };

  switch (interval) {
    case "day":
      group.viewsDay = { $sum: "$views" };
      projection.viewsDay = 1;
      break;
    case "week":
      group.viewsWeek = { $sum: "$views" };
      projection.viewsWeek = 1;
      date = daysFrom({ days: -7, date: date });
      break;
    case "month":
      group.viewsMonth = { $sum: "$views" };
      projection.viewsMonth = 1;
      date = daysFrom({ days: -30, date: date });
      break;
  }
  return [
    { $match: { updatedAt: { $gte: date } } },
    {
      $group: group,
    },
    {
      $project: projection,
    },
  ];
};

async function run() {
  try {
    const calculation = await doWithRetries(async () =>
      userDb
        .collection("View")
        .aggregate([
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
              viewsDay: { $ifNull: ["$merged.viewsDay", 0] },
              viewsWeek: { $ifNull: ["$merged.viewsWeek", 0] },
              viewsMonth: { $ifNull: ["$merged.viewsMonth", 0] },
              userName: "$merged.userName",
              userId: "$merged.userId",
              part: "$merged.part",
              concern: "$merged.concern",
              page: "$merged.page",
              connectId: "$merged.connectId",
            },
          },
        ])
        .toArray()
    );

    if (calculation.length === 0) return;

    const payPerView = +process.env.PAY_PER_MILLE / 1000;

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const updateObjects = calculation.map((obj) => {
      const { viewsDay, viewsWeek, viewsMonth, ...rest } = obj;
      return {
        updateOne: {
          filter: { ...rest, updatedAt: midnight },
          update: {
            $set: {
              viewsDay,
              viewsWeek,
              viewsMonth,
              earnedDay: payPerView * viewsDay,
              earnedWeek: payPerView * viewsDay,
              earnedMonth: payPerView * viewsMonth,
            },
          },
          upsert: true,
        },
      };
    });

    if (updateObjects.length > 0)
      await doWithRetries(() =>
        userDb.collection("ViewTotal").bulkWrite(updateObjects)
      );
  } catch (err) {
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
