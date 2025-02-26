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

async function bulkWriteInBatches(
  collectionName: string,
  ops: any,
  batchSize = 500
) {
  for (let i = 0; i < ops.length; i += batchSize) {
    await doWithRetries(() =>
      db.collection(collectionName).bulkWrite(ops.slice(i, i + batchSize))
    );
  }
}

async function run() {
  try {
    let suggestions = (await doWithRetries(() =>
      db.collection("Suggestion").find().toArray()
    )) as unknown as SuggestionType[];

    suggestions = suggestions.map((s) => ({
      ...s,
      description: s.description || s.name,
    }));

    const updatedSuggestions = await Promise.all(
      suggestions.map((suggestion) =>
        extractVariantFeatures({
          suggestion,
          categoryName: CategoryNameEnum.PRODUCTS,
        })
      )
    );
    
    const vectorizedSuggestions = await vectorizeSuggestions({
      suggestions: updatedSuggestions.filter(Boolean),
      categoryName: CategoryNameEnum.PRODUCTS,
    });

    const suggestionOps = vectorizedSuggestions.map(({ _id, ...rest }) => ({
      updateOne: { filter: { _id: new ObjectId(_id) }, update: { $set: rest } },
    }));

    if (suggestionOps.length)
      await bulkWriteInBatches("Suggestion", suggestionOps);

    const solutions = (await doWithRetries(() =>
      db
        .collection("Solution")
        .find(
          { productTypes: { $ne: [] } },
          { projection: { key: 1, productTypes: 1 } }
        )
        .toArray()
    )) as unknown as SolutionType[];

    const solutionOps = solutions.map((solution) => {
      const suggestionsForSolution = vectorizedSuggestions
        .filter((sug) => solution.productTypes.includes(sug.suggestion))
        .map(({ vectorizedOn, ...rest }) => rest);
      return {
        updateOne: {
          filter: { key: solution.key },
          update: { $set: { suggestions: suggestionsForSolution } },
        },
      };
    });
    if (solutionOps.length) await bulkWriteInBatches("Solution", solutionOps);

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const uniqueProductTypes = [
      ...new Set(vectorizedSuggestions.map((s) => s.suggestion)),
    ];

    const tasks = (await doWithRetries(() =>
      db
        .collection("Task")
        .find(
          {
            startsAt: { $gt: todayMidnight },
            productTypes: { $in: uniqueProductTypes },
          },
          { projection: { key: 1, productTypes: 1 } }
        )
        .toArray()
    )) as unknown as SolutionType[];

    const uniqueTasks = tasks.filter(
      (t, i, self) => i === self.findIndex((task) => task.key === t.key)
    );

    const taskOps = uniqueTasks.map((task) => {
      const suggestionsForTask = vectorizedSuggestions
        .filter((sug) => task.productTypes.includes(sug.suggestion))
        .map(({ vectorizedOn, ...rest }) => rest);
      return {
        updateOne: {
          filter: { key: task.key },
          update: { $set: { suggestions: suggestionsForTask } },
        },
      };
    });

    if (taskOps.length) await bulkWriteInBatches("Task", taskOps);

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
  } finally {
    await client.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
