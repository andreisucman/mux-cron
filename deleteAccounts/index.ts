import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const { deletedCount } = await doWithRetries(async () =>
      db.collection("User").deleteMany({
        deleteOn: { $lte: new Date() },
      })
    );

    await addCronLog({
      functionName: "deleteAccounts",
      isError: false,
      message: `${deletedCount} accounts deleted`,
    });
  } catch (err) {
    await addCronLog({
      functionName: "deleteAccounts",
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
