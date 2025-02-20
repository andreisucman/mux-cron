import * as dotenv from "dotenv";
dotenv.config();
import z from "zod";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import askRepeatedly from "functions/askRepeatedly.js";
import { RunType, CategoryNameEnum } from "@/functions/types.js";
import { toSentenceCase } from "@/helpers/utils.js";

type Props = {
  categoryName: CategoryNameEnum;
  extractedVariantFeatures: { featuresAndFunctionalities: string[] }[];
};

export default async function createACommonTableOfProductFeatures({
  extractedVariantFeatures,
  categoryName,
}: Props) {
  try {
    const originalList = extractedVariantFeatures
      .flatMap((obj) => obj.featuresAndFunctionalities.map((f) => `-${f}`))
      .join("\n");

    /* find the related variants */
    const systemContent = `You are given the features of several products after ###. Your goal is to combine them into a single comprehensive product comparison check list. This checklist should be free from marketing claims and general information and capable of helping easily determine the differences between the products. Think step-by-step.`;

    const CommonTableFeaturesType = z.object({
      checklist: z
        .array(z.string())
        .describe("An array of product comparison criteria"),
    });

    const runs: RunType[] = [
      {
        isMini: true,
        model: process.env.TUNED_MODELS,
        content: [
          {
            type: "text",
            text: `List of feaures: ${originalList}`,
          },
        ],
        responseFormat: zodResponseFormat(
          CommonTableFeaturesType,
          "CommonTableFeaturesType"
        ),
      },
    ];

    const response = await askRepeatedly({
      systemContent,
      runs,
      categoryName,
      functionName: "createACommonTableOfProductFeatures",
    });

    let checklist = [];

    if (response.checklist) {
      checklist = response.checklist.map((feature: string) =>
        toSentenceCase(feature)
      );
    }

    return checklist;
  } catch (err) {
    throw err;
  }
}
