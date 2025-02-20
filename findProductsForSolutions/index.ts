import * as dotenv from "dotenv";
dotenv.config();
import { client, db } from "@/init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import findProducts from "./functions/findProducts.js";
import { CategoryNameEnum, SolutionType } from "./functions/types.js";
import vectorizeSuggestions from "./functions/vectorizeSuggestions.js";

async function run() {
  try {
    const dayOfMonth = new Date().getDate();
    let status = "skipped";

    // if (dayOfMonth % 28 === 0) {
    status = "analyzed";

    const solutions = (await doWithRetries(async () =>
      db
        .collection("Solution")
        .find(
          { productTypes: { $ne: [] } },
          {
            projection: {
              description: 1,
              productTypes: 1,
            },
          }
        )
        .toArray()
    )) as unknown as SolutionType[];

    const batchSize = 50;
    const bulkWriteOps: any = [];

    for (const solution of solutions) {
      const suggestions = await findProducts({
        solution,
        categoryName: CategoryNameEnum.PRODUCTS,
      });

      await vectorizeSuggestions({
        suggestions,
        categoryName: CategoryNameEnum.PRODUCTS,
      });

      bulkWriteOps.push({
        updateOne: {
          filter: { key: solution.key },
          update: { $set: { suggestions } },
        },
      });

      if (bulkWriteOps.length >= batchSize) {
        await doWithRetries(async () =>
          db.collection("Solution").bulkWrite(bulkWriteOps)
        );
        bulkWriteOps.length = 0;
      }
    }

    if (bulkWriteOps.length > 0)
      await doWithRetries(async () =>
        db.collection("Solution").bulkWrite(bulkWriteOps)
      );
    // }

    await addCronLog({
      functionName: "findProductsForSolutions",
      message: `Completed - ${status}`,
      isError: false,
    });
  } catch (err) {
    await addCronLog({
      functionName: "findProductsForSolutions",
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
