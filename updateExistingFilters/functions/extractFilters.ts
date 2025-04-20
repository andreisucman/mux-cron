import { db } from "init.js";
import doWithRetries from "helpers/doWithRetries.js";

type Props = {
  collection: string;
  filter?: { [key: string]: any };
};

export default async function extractFilters({ collection, filter }: Props) {
  try {
    if (!collection) throw new Error("Collection name is missing");

    const pipeline: { [key: string]: any }[] = [
      {
        $project: {
          part: 1,
          taskName: 1,
          concerns: { $ifNull: ["$concerns", []] },
          sex: "$demographics.sex",
          ageInterval: "$demographics.ageInterval",
          bodyType: "$demographics.bodyType",
          skinColor: "$demographics.skinColor",
          skinType: "$demographics.skinType",
          ethnicity: "$demographics.ethnicity",
        },
      },
      {
        $unwind: {
          path: "$concerns",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          taskName: { $addToSet: "$taskName" },
          sex: { $addToSet: "$sex" },
          part: { $addToSet: "$part" },
          concerns: { $addToSet: "$concerns" },
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
          taskName: { $setDifference: ["$taskName", [null]] },
          sex: { $setDifference: ["$sex", [null]] },
          part: { $setDifference: ["$part", [null]] },
          concerns: {
            $setDifference: ["$concerns", [null]],
          },
          ageInterval: { $setDifference: ["$ageInterval", [null]] },
          bodyType: { $setDifference: ["$bodyType", [null]] },
          skinColor: { $setDifference: ["$skinColor", [null]] },
          skinType: { $setDifference: ["$skinType", [null]] },
          ethnicity: { $setDifference: ["$ethnicity", [null]] },
        },
      },
    ];

    if (filter) pipeline.unshift({ $match: filter });

    return await doWithRetries(async () => db.collection(collection).aggregate(pipeline).next());
  } catch (error) {
    throw error;
  }
}
