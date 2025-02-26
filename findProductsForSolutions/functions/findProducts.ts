import extractVariantFeatures from "functions/extractVariantFeatures.js";
import doWithRetries from "helpers/doWithRetries.js";
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
    let suggestions = (await doWithRetries(async () =>
      db
        .collection("Suggestion")
        .find({
          suggestion: productType,
        })
        .toArray()
    )) as unknown as SuggestionType[];

    suggestions = suggestions.map((s) =>
      s.description ? s : { ...s, description: s.name }
    );

    const extractFeaturesPromises = suggestions.map((s: SuggestionType) =>
      extractVariantFeatures({
        suggestion: s,
        categoryName,
      })
    );

    const suggestionsWithProductFeatures = await Promise.all(
      extractFeaturesPromises
    );

    return suggestionsWithProductFeatures;
  } catch (err) {
    throw err;
  }
}
