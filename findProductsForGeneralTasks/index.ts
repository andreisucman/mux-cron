import * as dotenv from "dotenv";
dotenv.config();
import { client } from "@/init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";

async function run() {
  try {
    const dayOfMonth = new Date().getDate();
    let status = "skipped";

    if (dayOfMonth % 28 === 0) {
      status = "analyzed";

      await doWithRetries(async () =>
        fetch(`${process.env.SERVER_URL!}/findProductsForGeneralTasks`, {
          method: "POST",
          headers: {
            authorization: process.env.API_KEY!,
          },
        })
      );
    }

    await addCronLog({
      functionName: "findProductsForGeneralTasks",
      message: `Completed - ${status}`,
      isError: false,
    });
  } catch (err) {
    await addCronLog({
      functionName: "findProductsForGeneralTasks",
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
