import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const maxStuckTime = new Date(new Date().getTime() - 20 * 60 * 1000);

    await doWithRetries(() =>
      db
        .collection("AnalysisStatus")
        .updateMany(
          { createdAt: { $lte: maxStuckTime } },
          {
            $set: { isError: true, isRunning: false, message: "Our servers are overloaded. Please try again." },
            $unset: { createdAt: null },
          }
        )
    );
  } catch (err) {
    await addCronLog({
      functionName: "endStuckAnalyses",
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
