import * as dotenv from "dotenv";
dotenv.config();
import { client, db } from "@/init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import findProducts from "./functions/findProducts.js";
import {
  CategoryNameEnum,
  SolutionType,
  SuggestionType,
} from "./functions/types.js";
import vectorizeSuggestions from "./functions/vectorizeSuggestions.js";
import { ObjectId } from "mongodb";

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
              key: 1,
              productTypes: 1,
            },
          }
        )
        .toArray()
    )) as unknown as SolutionType[];

    const batchSize = 50;
    const solutionBulkwriteOps: any = [];
    const suggestionBulkwriteOps: any = [];

    const uniqueProductTypes = [
      ...new Set(solutions.flatMap((s) => s.productTypes)),
    ];

    const readySuggestions: SuggestionType[] = [];

    for (const productType of uniqueProductTypes) {
      const suggestions = await findProducts({
        productType,
        categoryName: CategoryNameEnum.PRODUCTS,
      });

      const updatedSuggestions = await vectorizeSuggestions({
        suggestions,
        categoryName: CategoryNameEnum.PRODUCTS,
      });

      readySuggestions.push(...updatedSuggestions);

      if (suggestionBulkwriteOps.length >= batchSize) {
        await doWithRetries(async () =>
          db.collection("Suggestion").bulkWrite(suggestionBulkwriteOps)
        );
        suggestionBulkwriteOps.length = 0;
      }

      for (const suggestion of updatedSuggestions) {
        suggestionBulkwriteOps.push({
          updateOne: {
            filter: { _id: new ObjectId(suggestion._id) },
            update: {
              $set: suggestion,
            },
          },
        });
      }
    }

    if (suggestionBulkwriteOps.length > 0)
      await doWithRetries(async () =>
        db.collection("Suggestion").bulkWrite(suggestionBulkwriteOps)
      );

    for (const solution of solutions) {
      const relevantSuggestions = readySuggestions.filter((sug) =>
        solution.productTypes.includes(sug.suggestion)
      );

      solutionBulkwriteOps.push({
        updateOne: {
          filter: { key: solution.key },
          update: {
            $set: {
              suggestions: relevantSuggestions.map((s) => {
                const { vectorizedOn, ...rest } = s;
                return rest;
              }),
            },
          },
        },
      });

      if (solutionBulkwriteOps.length >= batchSize) {
        await doWithRetries(async () =>
          db.collection("Solution").bulkWrite(solutionBulkwriteOps)
        );
        solutionBulkwriteOps.length = 0;
      }
    }

    if (solutionBulkwriteOps.length > 0)
      await doWithRetries(async () =>
        db.collection("Solution").bulkWrite(solutionBulkwriteOps)
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
