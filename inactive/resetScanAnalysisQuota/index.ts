import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const response = await doWithRetries(async () =>
      db.collection("User").updateMany(
        {
          scanAnalysisQuota: 0,
        },
        { $inc: { scanAnalysisQuota: 1 } }
      )
    );

    await addCronLog({
      functionName: "resetScanAnalysisQuota",
      isError: false,
      message: `Updated ${response.modifiedCount} accounts.`,
    });
  } catch (err) {
    await addCronLog({
      functionName: "resetScanAnalysisQuota",
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
