import * as dotenv from "dotenv";
dotenv.config();
import { ObjectId } from "mongodb";
import { client, db } from "@/init.js";
import doWithRetries from "helpers/doWithRetries.js";
import addCronLog from "helpers/addCronLog.js";
import {
  CategoryNameEnum,
  SolutionType,
  SuggestionType,
} from "./functions/types.js";
import vectorizeSuggestions from "./functions/vectorizeSuggestions.js";
import extractVariantFeatures from "./functions/extractVariantFeatures.js";

async function run() {
  try {
    let allSuggestions = (await doWithRetries(async () =>
      db.collection("Suggestion").find().toArray()
    )) as unknown as SuggestionType[];

    allSuggestions = allSuggestions.map((s) =>
      s.description ? s : { ...s, description: s.name }
    );

    let updatedSuggestions: SuggestionType[] = [];
    for (const suggestion of allSuggestions) {
      const updatedSuggestion = await extractVariantFeatures({
        suggestion,
        categoryName: CategoryNameEnum.PRODUCTS,
      });
      updatedSuggestions.push(updatedSuggestion);
    }

    updatedSuggestions = await vectorizeSuggestions({
      suggestions: updatedSuggestions.filter((s) => Boolean(s)),
      categoryName: CategoryNameEnum.PRODUCTS,
    });

    const batchSize = 50;
    let solutionBulkwriteOps: any = [];
    let suggestionBulkwriteOps: any = [];

    for (const suggestion of updatedSuggestions) {
      const { _id, ...rest } = suggestion;
      suggestionBulkwriteOps.push({
        updateOne: {
          filter: { _id: new ObjectId(_id) },
          update: {
            $set: rest,
          },
        },
      });
    }

    if (suggestionBulkwriteOps.length > 0) {
      await doWithRetries(async () =>
        db.collection("Suggestion").bulkWrite(suggestionBulkwriteOps)
      );
    }

    if (
      suggestionBulkwriteOps.length > 0 &&
      suggestionBulkwriteOps.length >= batchSize
    ) {
      await doWithRetries(async () =>
        db.collection("Suggestion").bulkWrite(suggestionBulkwriteOps)
      );
      suggestionBulkwriteOps = [];
    }

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

    for (const solution of solutions) {
      const relevantSuggestions = allSuggestions.filter((sug) =>
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

      if (
        solutionBulkwriteOps.length > 0 &&
        solutionBulkwriteOps.length >= batchSize
      ) {
        await doWithRetries(async () =>
          db.collection("Solution").bulkWrite(solutionBulkwriteOps)
        );
        solutionBulkwriteOps = [];
      }
    }

    if (solutionBulkwriteOps.length > 0) {
      await doWithRetries(async () =>
        db.collection("Solution").bulkWrite(solutionBulkwriteOps)
      );
    }

    await addCronLog({
      functionName: "findProductsForSolutions",
      message: "Completed",
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
