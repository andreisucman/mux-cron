import createACommonTableOfProductFeatures from "@/functions/createACommonTableOfProductFeatures.js";
import extractVariantFeatures from "functions/extractVariantFeatures.js";
import doWithRetries from "helpers/doWithRetries.js";
import findTheBestVariant from "functions/findTheBestVariant.js";
import { SuggestionType, CategoryNameEnum } from "@/functions/types.js";
import { db } from "init.js";

type Props = {
  productType: string;
  categoryName: CategoryNameEnum;
};

export default async function findProducts({
  productType,
  categoryName,
}: Props) {
  try {
    const suggestions = (await doWithRetries(async () =>
      db
        .collection("Suggestion")
        .find({
          suggestion: productType,
        })
        .toArray()
    )) as unknown as SuggestionType[];

    const extractFeaturesPromises = suggestions.map((s) =>
      extractVariantFeatures({
        variantData: s,
        categoryName,
      })
    );

    const extractedFeaturesObjectsArray = await Promise.all(
      extractFeaturesPromises
    );

    const commonListOfFeatures = await createACommonTableOfProductFeatures({
      extractedVariantFeatures: extractedFeaturesObjectsArray,
      categoryName,
    });

    const chosenProductsResults = await findTheBestVariant({
      commonListOfFeatures,
      suggestions,
      categoryName,
    });

    return chosenProductsResults;
  } catch (err) {
    throw err;
  }
}
