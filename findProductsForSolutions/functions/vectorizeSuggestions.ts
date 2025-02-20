import natural from "natural";
import createTextEmbedding from "@/functions/createTextEmbedding.js";
import { upperFirst } from "@/helpers/utils.js";
import { db } from "@/init.js";
import doWithRetries from "@/helpers/doWithRetries.js";
import { CategoryNameEnum } from "@/functions/types.js";
import {
  ValidatedSuggestionType,
  VectorizedSuggestionType,
} from "@/functions/types.js";
import { ObjectId } from "mongodb";

type Props = {
  suggestions: ValidatedSuggestionType[];
  categoryName: CategoryNameEnum;
};

const tokenizer = new natural.SentenceTokenizer([]);

export default async function vectorizeSuggestions({
  categoryName,
  suggestions,
}: Props) {
  try {
    await doWithRetries(async () =>
      db.collection("SuggestionVector").deleteMany({})
    );

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const notVectorizedSuggestions = suggestions.filter(
      (sug) => !sug.vectorizedOn || new Date(sug.vectorizedOn) < todayMidnight
    );

    const vectorizedSuggestions: VectorizedSuggestionType[] = [];

    for (const suggestion of notVectorizedSuggestions) {
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
          name,
          url,
          suggestion: suggestionName,
          rating,
          priceAndUnit,
        } = suggestion;

        vectorizedSuggestions.push({
          suggestionId: suggestion._id,
          suggestionName,
          name,
          url,
          rating,
          priceAndUnit,
          embeddingText: textsToEmbed[j],
          embedding,
          createdAt: new Date(),
        });
      }
    }

    await doWithRetries(async () =>
      db.collection("SuggestionVector").insertMany(vectorizedSuggestions)
    );

    const uniqueSuggestionIds = [
      ...new Set(notVectorizedSuggestions.map((s) => s._id)),
    ];

    const response = await doWithRetries(async () =>
      db.collection("Suggestion").updateMany(
        {
          _id: {
            $in: uniqueSuggestionIds.map((id) => new ObjectId(id)),
          },
        },
        { $set: { vectorizedOn: todayMidnight } }
      )
    );

    console.log("response", response);
  } catch (err) {
    throw err;
  }
}
