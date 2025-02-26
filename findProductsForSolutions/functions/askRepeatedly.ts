import * as dotenv from "dotenv";
dotenv.config();

import doWithRetries from "helpers/doWithRetries.js";
import { AskOpenaiProps, RunType } from "@/functions/types.js";
import { CategoryNameEnum } from "@/functions/types.js";
import askOpenai from "@/functions/askOpenai.js";
import generateSeed from "@/functions/generateSeed.js";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";

type Props = {
  runs: RunType[];
  seed?: number;
  userId?: string;
  categoryName: CategoryNameEnum;
  functionName: string;
  systemContent: string;
  isResultString?: boolean;
};

async function askRepeatedly({
  runs,
  seed,
  userId,
  functionName,
  categoryName,
  systemContent,
  isResultString,
}: Props) {
  try {
    let finalSeed = seed;
    let result;

    if (!finalSeed) {
      finalSeed = generateSeed(userId);
    }

    let conversation: ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
    ];

    for (let i = 0; i < runs.length; i++) {
      conversation.push({
        role: "user",
        content: runs[i].content,
      });

      const payload: AskOpenaiProps = {
        userId,
        functionName,
        categoryName,
        seed,
        messages: conversation,
        isMini: runs[i].isMini,
        isJson: isResultString ? false : i === runs.length - 1,
      };

      if (runs[i].model) payload.model = runs[i].model;
      if (runs[i].responseFormat)
        payload.responseFormat = runs[i].responseFormat;

      result = await doWithRetries(async () => askOpenai(payload));

      conversation.push({
        role: "assistant",
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      });

      if (runs[i].callback) {
        runs[i].callback();
      }
    }

    return result;
  } catch (err) {
    throw err;
  }
}

export default askRepeatedly;
