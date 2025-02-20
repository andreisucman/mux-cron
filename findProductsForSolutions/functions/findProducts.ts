import createACommonTableOfProductFeatures from "@/functions/createACommonTableOfProductFeatures.js";
import extractVariantFeatures from "functions/extractVariantFeatures.js";
import doWithRetries from "helpers/doWithRetries.js";
import findTheBestVariant from "functions/findTheBestVariant.js";
import isTheProductValid from "functions/isTheProductValid.js";
import {
  SuggestionType,
  ValidatedSuggestionType,
  CategoryNameEnum,
  SolutionType,
} from "@/functions/types.js";
import { db } from "init.js";

type Props = {
  solution: SolutionType;
  categoryName: CategoryNameEnum;
};

export default async function findProducts({ solution, categoryName }: Props) {
  const { productTypes, description: taskDescription } = solution;

  try {
    const suggestions = (await doWithRetries(async () =>
      db
        .collection("Suggestion")
        .find({
          suggestion: { $in: productTypes },
        })
        .toArray()
    )) as unknown as SuggestionType[];

    const productCheckPromises = suggestions.map(
      async (draft) =>
        await doWithRetries(async () =>
          isTheProductValid({
            taskDescription,
            data: draft,
            categoryName,
          })
        )
    );

    const productCheckObjectsArray: ValidatedSuggestionType[] =
      await Promise.all(productCheckPromises);

    const validProducts = productCheckObjectsArray.filter((obj) =>
      Boolean(obj.verdict)
    );

    const updatedValidProducts = validProducts.map(
      (item: ValidatedSuggestionType) => {
        const { verdict, ...rest } = item;
        return rest;
      }
    );

    const distinctSuggestionTypes = [
      ...new Set(updatedValidProducts.map((obj) => obj.suggestion)),
    ];

    const chosenProductsPromises = distinctSuggestionTypes.map(
      async (suggestionType) => {
        try {
          const filteredProducts = updatedValidProducts.filter(
            (object) => object.suggestion === suggestionType
          );

          const extractFeaturesPromises = filteredProducts.map((v) =>
            extractVariantFeatures({
              taskDescription,
              variantData: v,
              categoryName,
            })
          );

          const extractedFeaturesObjectsArray = await Promise.all(
            extractFeaturesPromises
          );

          const commonListOfFeatures =
            await createACommonTableOfProductFeatures({
              extractedVariantFeatures: extractedFeaturesObjectsArray,
              categoryName,
            });

          return await findTheBestVariant({
            commonListOfFeatures,
            taskDescription,
            validProducts: filteredProducts,
            categoryName,
          });
        } catch (err) {
          throw err;
        }
      }
    );

    const chosenProductsResults = await Promise.all(chosenProductsPromises);

    return chosenProductsResults.flat();
  } catch (err) {
    throw err;
  }
}
