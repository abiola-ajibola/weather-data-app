import { z } from "zod";
import { defaultFilterColumns } from "./constants";


export const filtersSchema = z.array(
  z.optional(
    z.object({
      column: z.enum(defaultFilterColumns.map((col) => col.key)),
      operator: z.enum([
        "min-value",
        "max-value",
        "exact",
        "contains",
        "not",
        "is",
        "before",
        "after",
        "on",
      ]),
      value: z.union([z.string(), z.number()]),
    }),
  ),
);

export const getInitialFilters = (value: string | null) => {
  if (!value) return [];
  try {
    const result = filtersSchema.safeParse(JSON.parse(value) || []);

    return result.success
      ? result.data.filter((item) => item !== undefined)
      : [];
  } catch (error) {
    console.log({ error });
    return [];
  }
};