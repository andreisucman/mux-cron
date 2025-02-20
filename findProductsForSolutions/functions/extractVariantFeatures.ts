import z from "zod";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import askRepeatedly from "functions/askRepeatedly.js";
import { RunType } from "@/functions/types.js";
import { CategoryNameEnum } from "@/functions/types.js";

type Props = {
  categoryName: CategoryNameEnum;
  variantData: { name: string; description: string };
  taskDescription: string;
};

export default async function extractVariantFeatures({
  variantData,
  categoryName,
  taskDescription,
}: Props) {
  const { name, description } = variantData;

  try {
    const systemContent = `You are a strict and objective analyst. You are given a name and description of a product from amazon.com after ###. Extract all of it's features that are related to this use case: ${taskDescription}. Think step-by-step. ### Product name: ${name}. Product description: ${description}.`;

    const VariantFeaturesType = z.object({
      featuresAndFunctionalities: z.array(z.string()),
    });

    const runs: RunType[] = [
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: `Are the features and functionalities you extracted mentioned in the description of the product? Remove those that are not.`,
          },
        ],
      },
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: `Rewrite the list and leave only specific information from the description. Example of your response: Does not weigh down hair. \nDoesn't contain fragrance. \nVegan and cruelty-free.\nClinically tested. \nComes with 6 month supply. \nIncludes biotin.`,
          },
        ],
      },
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: `Eliminate generic claims that don't help with product comparison such as claims of high quality, usage frequency, time to result and others.`,
          },
        ],
      },
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: `Format your response as a JSON object with this structure: {featuresAndFunctionalities: [string, string, ...]}. Example: {featuresAndFunctionalities: ["Does not weigh down hair", "Non-greasy formula", "Cruelty-free"...]}`,
          },
        ],
        responseFormat: zodResponseFormat(
          VariantFeaturesType,
          "VariantFeaturesType"
        ),
      },
    ];

    const response = await askRepeatedly({
      systemContent,
      runs,
      categoryName,
      functionName: "extractVariantFeatures",
    });

    return {
      featuresAndFunctionalities: response.featuresAndFunctionalities,
      ...variantData,
    };
  } catch (err) {
    throw err;
  }
}
