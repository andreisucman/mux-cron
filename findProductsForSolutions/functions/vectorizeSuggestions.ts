import natural from "natural";
import createTextEmbedding from "@/functions/createTextEmbedding.js";
import { upperFirst } from "@/helpers/utils.js";
import { db } from "@/init.js";
import doWithRetries from "@/helpers/doWithRetries.js";
import { CategoryNameEnum, SuggestionType } from "@/functions/types.js";
import { AnyBulkWriteOperation } from "mongodb";

type Props = {
  suggestions: SuggestionType[];
  categoryName: CategoryNameEnum;
};

type UpdateOp = AnyBulkWriteOperation<Document>;

const tokenizer = new natural.SentenceTokenizer([]);

async function processUpdates(
  insertOps: UpdateOp[],
  suggestions: SuggestionType[],
  todayMidnight: Date
) {
  if (insertOps.length === 0) return suggestions;

  await doWithRetries(async () =>
    db.collection("SuggestionVector").bulkWrite(insertOps as any)
  );

  const uniqueUpdatedIds = [
    ...new Set(
      insertOps.map((op: any) => String(op.insertOne.document.suggestionId))
    ),
  ];

  return suggestions.map((s) =>
    uniqueUpdatedIds.includes(String(s._id))
      ? { ...s, vectorizedOn: todayMidnight }
      : s
  );
}

export default async function vectorizeSuggestions({
  categoryName,
  suggestions,
}: Props) {
  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const suggestionsToBeVectorized = suggestions.filter(
      (sug) => !sug.vectorizedOn || new Date(sug.vectorizedOn) < todayMidnight
    );

    const batchSize = 100;
    let insertOps: any[] = [];
    const vectorizedSuggestions: SuggestionType[] = [];

    for (const suggestion of suggestionsToBeVectorized) {
      const sentences = tokenizer.tokenize(suggestion.description);

      const textsToEmbed = [];

      const step = 5;
      for (let i = 0; i < sentences.length; i += step) {
        const descriptionSentences = sentences.slice(i, (i += step)).join("\n");
        textsToEmbed.push(
          `${upperFirst(suggestion.type)}: ${suggestion.suggestion}.\nName: ${
            suggestion.name
          }.\nDescription: ${descriptionSentences}.\nRating: ${
            suggestion.rating
          }.\nPrice and unit: ${suggestion.priceAndUnit}.`
        );
      }

      for (let j = 0; j < textsToEmbed.length; j++) {
        const embedding = await createTextEmbedding({
          categoryName,
          dimensions: 1536,
          text: textsToEmbed[j],
        });

        const {
          _id,
          name,
          url,
          suggestion: suggestionName,
          rating,
          priceAndUnit,
        } = suggestion;

        const newRecord = {
          insertOne: {
            document: {
              suggestionId: _id,
              suggestionName,
              name,
              url,
              rating,
              priceAndUnit,
              embeddingText: textsToEmbed[j],
              embedding,
              createdAt: new Date(),
            },
          },
        };

        insertOps.push(newRecord);

        if (insertOps.length >= batchSize) {
          const newVectorizedSuggestions = await processUpdates(
            insertOps,
            suggestions,
            todayMidnight
          );

          vectorizedSuggestions.push(...newVectorizedSuggestions);

          insertOps = [];
        }
      }
    }

    if (insertOps.length > 0) {
      const newVectorizedSuggestions = await processUpdates(
        insertOps,
        suggestions,
        todayMidnight
      );

      vectorizedSuggestions.push(...newVectorizedSuggestions);
    }

    const updatedSuggestions = suggestions.map((suggestion) => {
      const matchingVectorizedSuggestion = vectorizedSuggestions.find(
        (v) => v.suggestion === suggestion.suggestion
      );

      if (matchingVectorizedSuggestion) {
        return { ...suggestion, ...matchingVectorizedSuggestion };
      }

      return suggestion;
    });

    return updatedSuggestions;
  } catch (err) {
    throw err;
  }
}
