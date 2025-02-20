import askRepeatedly from "functions/askRepeatedly.js";
import {
  RunType,
  CategoryNameEnum,
  SuggestionType,
} from "@/functions/types.js";
import z from "zod";
import { zodResponseFormat } from "openai/helpers/zod.mjs";

type Props = {
  data: SuggestionType;
  taskDescription: string;
  categoryName: CategoryNameEnum;
};

export default async function isTheProductValid({
  categoryName,
  data,
  taskDescription,
}: Props) {
  const { name, suggestion } = data;

  try {
    const ResponseFormat = z.object({
      isValid: z
        .boolean()
        .describe(
          "true if the product confirms the task description, false if not"
        ),
    });
    const systemContent = `The user gives you the name of a product or service. Your goal is to identify if this product or service is relevant to this task: ##${taskDescription}##`;

    const runs: RunType[] = [
      {
        isMini: true,
        content: [
          {
            type: "text",
            text: `Product or service name: ${name}. Product or service type: ${suggestion}.`,
          },
        ],
        responseFormat: zodResponseFormat(
          ResponseFormat,
          "IsTheProductValidResponseType"
        ),
      },
    ];

    const response = await askRepeatedly({
      systemContent,
      runs,
      categoryName,
      functionName: "isTheProductValid",
    });

    return {
      ...data,
      verdict: response.isValid,
    };
  } catch (err) {
    throw err;
  }
}
