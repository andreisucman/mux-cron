import z from "zod";
import askRepeatedly from "functions/askRepeatedly.js";
import {
  ValidatedSuggestionType,
  SimplifiedProductType,
  CategoryNameEnum,
  RunType,
} from "./types.js";
import { zodResponseFormat } from "openai/helpers/zod.mjs";

type Props = {
  categoryName: CategoryNameEnum;
  validProducts: ValidatedSuggestionType[];
  commonListOfFeatures: string[];
  taskDescription: string;
};

export default async function findTheBestVariant({
  categoryName,
  validProducts,
  taskDescription,
  commonListOfFeatures,
}: Props) {
  const simplifiedVariants = validProducts.map(
    (variant: ValidatedSuggestionType) => ({
      name: variant.name,
      description: variant.description,
      asin: variant.asin,
      rating: variant.rating,
      priceAndUnit: variant.priceAndUnit,
    })
  );

  const list = simplifiedVariants
    .map(
      (rec: ValidatedSuggestionType, index: number) =>
        `Product ${index + 1}. Name: ${rec.name}. Description: ${
          rec.description
        }. Asin: ${rec.asin}. Reviews rating: ${rec.rating}. Price and unit: ${
          rec.priceAndUnit
        }`
    )
    .join("\n");

  const listOfUniqueFeatures = [...new Set(commonListOfFeatures)];
  const featuresList = listOfUniqueFeatures.join("\n");

  const analysisObject = listOfUniqueFeatures.reduce<
    Record<string, z.ZodType<any>>
  >((a, c) => {
    a[c] = z
      .boolean()
      .describe("true if the product has this feature, false if not");
    return a;
  }, {});

  const FeatureAnalysisType = z.object(analysisObject);

  try {
    /* find the related variants */
    const systemContent = `You are a professional purchase product analyst. The user gives you a list of products. Your goal is to rank the products based on their features for this use case: ${taskDescription}. Consider rank 1 to be the highest. Be detailed. Use casual language. Be objective. Think step-by-step.`;

    const runs: RunType[] = [
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: `Products: ${list}##.`,
          },
        ],
      },
    ];

    runs.push({
      isMini: true,
      content: [
        {
          type: "text",
          text: `Create the analysisResult for each product with this structure {[key: name of the feature from the feature list]: boolean}, where key is the name of the feature from this features list: ##${featuresList}`,
        },
      ],
      responseFormat: zodResponseFormat(
        FeatureAnalysisType,
        "FeatureAnalysisType"
      ),
    });

    const FindTheBestVariantResponseType = z.object({
      rankedProducts: z.array(
        z.object({
          rank: z.number().describe("the rank of the product"),
          name: z.string().describe("name of the product"),
          reasoning: z.string().describe("your reasoning for the rank"),
          asin: z.string().describe("asin of the product"),
          analysisResult: z.object(analysisObject),
        })
      ),
    });

    runs.push({
      isMini: true,
      content: [
        {
          type: "text",
          text: `Does this product have any drawbacks compared to the other products? If yes, discuss them.`,
        },
      ],
      responseFormat: zodResponseFormat(
        FindTheBestVariantResponseType,
        "FindTheBestVariantResponseType"
      ),
    });

    const response = await askRepeatedly({
      systemContent,
      runs,
      categoryName,
      functionName: "findTheBestVariant",
    });

    const { rankedProducts } = response || [];

    const enrichedProducts: ValidatedSuggestionType[] = rankedProducts
      .map((product: SimplifiedProductType) => {
        const match = validProducts.find((vp) => vp.asin === product.asin);

        if (!match) return;

        return { ...match, ...product };
      })
      .filter(Boolean);

    return enrichedProducts;
  } catch (err) {
    throw err;
  }
}
