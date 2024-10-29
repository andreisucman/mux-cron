import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "./helpers/doWithRetries.js";
import addErrorLog from "./helpers/addErrorLog.js";
import addCronLog from "./helpers/addCronLog.js";
import extractFilters from "./functions/extractFilters.js";
import { db } from "./init.js";

async function run() {
  try {
    const beforeAfterFilters = await extractFilters({
      collection: "BeforeAfter",
    });

    const proofFilters = await extractFilters({
      collection: "Proof",
    });

    const styleFilters = await extractFilters({
      collection: "StyleAnalysis",
    });

    const toUpdate = [
      {
        updateOne: {
          filter: { collection: "BeforeAfter" },
          update: { filters: beforeAfterFilters },
        },
      },
      {
        updateOne: {
          filter: { collection: "Proof" },
          update: { filters: proofFilters },
        },
      },
      {
        updateOne: {
          filter: { collection: "StyleAnalysis" },
          update: { filters: styleFilters },
        },
      },
    ];

    await doWithRetries({
      functionName: "cron - updateExistingFilters - update",
      functionToExecute: async () =>
        db.collection("ExistingFilters").bulkWrite(toUpdate),
    });

    addCronLog({
      functionName: "updateExistingFilters",
      message: `filters updated`,
    });
  } catch (err) {
    addErrorLog({
      functionName: "cron - updateExistingFilters",
      message: err.message,
    });
  }
}

run();
