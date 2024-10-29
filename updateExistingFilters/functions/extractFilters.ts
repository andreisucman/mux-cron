import { db } from "../init.js";
import doWithRetries from "../helpers/doWithRetries.js";

type Props = {
  collection: string;
};

export default async function extractFilters({ collection }: Props) {
  try {
    if (!collection) throw new Error("Collection name is missing");

    return await doWithRetries({
      functionName: "extractFilters",
      functionToExecute: async () =>
        db
          .collection(collection)
          .aggregate([
            {
              $project: {
                type: 1,
                concern: 1,
                sex: "$demographics.sex",
                ageInterval: "$demographics.ageInterval",
                bodyType: "$demographics.bodyType",
                skinColor: "$demographics.skinColor",
                skinType: "$demographics.skinType",
                ethnicity: "$demographics.ethnicity",
              },
            },
            {
              $group: {
                _id: null,
                sex: { $addToSet: "$sex" },
                type: { $addToSet: "$type" },
                concern: { $addToSet: "$concern" },
                ageInterval: { $addToSet: "$ageInterval" },
                bodyType: { $addToSet: "$bodyType" },
                skinColor: { $addToSet: "$skinColor" },
                skinType: { $addToSet: "$skinType" },
                ethnicity: { $addToSet: "$ethnicity" },
              },
            },
            {
              $project: {
                _id: 0,
                sex: { $setDifference: ["$sex", [null]] },
                type: { $setDifference: ["$type", [null]] },
                concern: { $setDifference: ["$concern", [null]] },
                ageInterval: { $setDifference: ["$ageInterval", [null]] },
                bodyType: { $setDifference: ["$bodyType", [null]] },
                skinColor: { $setDifference: ["$skinColor", [null]] },
                skinType: { $setDifference: ["$skinType", [null]] },
                ethnicity: { $setDifference: ["$ethnicity", [null]] },
              },
            },
          ])
          .next(),
    });
  } catch (error) {
    throw error;
  }
}
