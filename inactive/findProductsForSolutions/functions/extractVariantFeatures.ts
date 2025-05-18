import * as dotenv from "dotenv";
dotenv.config();
import z from "zod";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import askRepeatedly from "functions/askRepeatedly.js";
import { RunType, SuggestionType } from "@/functions/types.js";
import { CategoryNameEnum } from "@/functions/types.js";

type Props = {
  categoryName: CategoryNameEnum;
  suggestion: SuggestionType;
};

export default async function extractVariantFeatures({
  suggestion,
  categoryName,
}: Props) {
  const { name, description } = suggestion;

  try {
    const systemContent =
      "You are a strict and objective analyst. The user gives you a name and description of a product. Your goals are 1) to create a 1-2 sentences elevator pitch featuring the most important features of the product and 2) extract all of the product's features into a check list. This checklist should be free from marketing claims and include only those features that can be objectively verified. Think step-by-step.";

    const VariantFeaturesType = z.object({
      intro: z
        .string()
        .describe(
          "1-2 sentences long elevator pitch featuring the most important features of the product"
        ),
      productFeatures: z
        .array(z.string())
        .describe("a list of product features"),
    });

    const runs: RunType[] = [
      {
        isMini: true,
        model: process.env.TUNED_MODELS,
        content: [
          {
            type: "text",
            text: `Name: ${name}. Description: ${description}.`,
          },
        ],
        responseFormat: zodResponseFormat(
          VariantFeaturesType,
          "VariantFeaturesType"
        ),
      },
    ];

    const { productFeatures, intro } = await askRepeatedly({
      systemContent,
      runs,
      categoryName,
      functionName: "extractVariantFeatures",
    });

    return {
      ...suggestion,
      productFeatures,
      intro,
    };
  } catch (err) {
    throw err;
  }
}
