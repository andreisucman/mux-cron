import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const oneHourAgo = new Date(new Date().getTime() - 3600000);

    const { deletedCount } = await doWithRetries(async () =>
      db.collection("User").deleteMany({
        createdAt: { $lte: oneHourAgo },
      })
    );

    await addCronLog({
      functionName: "deleteProcessedEvents",
      isError: false,
      message: `${deletedCount} events deleted`,
    });
  } catch (err) {
    await addCronLog({
      functionName: "deleteProcessedEvents",
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
