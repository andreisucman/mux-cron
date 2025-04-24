import * as dotenv from "dotenv";
dotenv.config();

import { db, client } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const oldestDate = new Date(new Date().getTime() - 27 * 1440 * 60 * 1000);

    const { modifiedCount } = await doWithRetries(() =>
      db.collection("Task").updateMany({ startsAt: { $lte: oldestDate } }, {
        $pull: {
          examples: { url: /www\.youtube\.com/ },
        },
      } as any)
    );

    await addCronLog({
      functionName: "removeOldYoutubeVideos",
      message: `${modifiedCount} documents updated`,
      isError: false,
    });
  } catch (err) {
    await addCronLog({
      functionName: "removeOldYoutubeVideos",
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
