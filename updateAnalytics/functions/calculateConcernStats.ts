import { adminDb } from "@/init.js";
import doWithRetries from "@/helpers/doWithRetries.js";

export default async function getTaskKeysCount() {
  const facetPipeline = [
    {
      $group: {
        _id: "$concerns.key",
        count: { $sum: 1 },
      },
    },
    {
      $project: { key: "$_id", count: 1, _id: 0 },
    },
  ];

  const result = await doWithRetries(async () =>
    adminDb
      .collection("UserStats")
      .aggregate([
        { $match: { concerns: { $exists: true } } },
        {
          $facet: {
            disabled: [
              { $match: { "concerns.isDisabled": true } },
              ...facetPipeline,
            ],
            active: [
              {
                $match: { "concerns.isDisabled": false },
              },
              ...facetPipeline,
            ],
            part: facetPipeline,
          },
        },
      ])
      .next()
  );

  const { part, disabled, active } = result;

  const partMap = part.reduce(
    (a: { [key: string]: number }, c: { key: string; count: number }) => {
      a[`overview.user.usage.concerns.part.${c.key}`] = c.count;
      return a;
    },
    {}
  );

  const activeMap = active.reduce(
    (a: { [key: string]: number }, c: { key: string; count: number }) => {
      a[`overview.user.usage.concerns.status.active.${c.key}`] = c.count;
      return a;
    },
    {}
  );

  const disabledMap = disabled.reduce(
    (a: { [key: string]: number }, c: { key: string; count: number }) => {
      a[`overview.user.usage.concerns.status.disabled.${c.key}`] = c.count;
      return a;
    },
    {}
  );

  return { part: partMap, active: activeMap, disabled: disabledMap };
}
