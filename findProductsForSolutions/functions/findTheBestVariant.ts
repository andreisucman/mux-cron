import z from "zod";
import askRepeatedly from "functions/askRepeatedly.js";
import {
  SimplifiedProductType,
  CategoryNameEnum,
  RunType,
  SuggestionType,
} from "./types.js";
import { zodResponseFormat } from "openai/helpers/zod.mjs";

type Props = {
  categoryName: CategoryNameEnum;
  suggestions: SuggestionType[];
  commonListOfFeatures: string[];
};

export default async function findTheBestVariant({
  categoryName,
  suggestions,
  commonListOfFeatures,
}: Props) {
  const simplifiedVariants = suggestions.map((variant: SuggestionType) => ({
    _id: variant._id,
    name: variant.name,
    description: variant.description,
    rating: variant.rating,
    priceAndUnit: variant.priceAndUnit,
  }));

  const list = simplifiedVariants
    .map(
      (rec: SuggestionType, index: number) =>
        `Product ${index + 1}. _Id: ${rec._id}. Name: ${
          rec.name
        }. Description: ${rec.description}. Reviews rating: ${
          rec.rating
        }. Price and unit: ${rec.priceAndUnit}`
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
    const systemContent = `You are a professional purchase product analyst. The user gives you a list of products. Your goal is to rank the products based on their features. Consider rank 1 to be the highest. Be detailed. Use casual language. Be objective. Think step-by-step.`;

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
          _id: z.string().describe("the id of the product"),
          rank: z.number().describe("the rank of the product"),
          reasoning: z.string().describe("your reasoning for the rank"),
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

    const enrichedProducts: SuggestionType[] = rankedProducts
      .map((product: SimplifiedProductType) => {
        const match = suggestions.find(
          (vp) => String(vp._id) === String(product._id)
        );

        if (!match) return;

        return { ...match, ...product };
      })
      .filter(Boolean);

    return enrichedProducts;
  } catch (err) {
    throw err;
  }
}
