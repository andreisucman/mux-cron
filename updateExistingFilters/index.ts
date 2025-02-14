import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "./helpers/doWithRetries.js";
import addCronLog from "./helpers/addCronLog.js";
import extractFilters from "./functions/extractFilters.js";
import { db, client } from "./init.js";

async function run() {
  try {
    const solutionsFilters = await extractFilters({
      collection: "Solution",
    });

    const beforeAfterFilters = await extractFilters({
      collection: "BeforeAfter",
      filter: { isPublic: true },
    });

    const proofFilters = await extractFilters({
      collection: "Proof",
      filter: { isPublic: true },
    });

    const toUpdate = [
      {
        updateOne: {
          filter: { collection: "Solution" },
          update: { $set: { filters: solutionsFilters } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { collection: "BeforeAfter" },
          update: { $set: { filters: beforeAfterFilters } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { collection: "Proof" },
          update: { $set: { filters: proofFilters } },
          upsert: true,
        },
      },
    ];

    await doWithRetries(async () =>
      db.collection("ExistingFilters").bulkWrite(toUpdate)
    );

    await addCronLog({
      functionName: "updateExistingFilters",
      message: "Filters updated",
      isError: false,
    });
  } catch (err) {
    await addCronLog({
      functionName: "updateExistingFilters",
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
