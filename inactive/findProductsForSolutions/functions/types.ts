import {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/src/resources/index.js";

export type SimplifiedProductType = {
  _id: string;
  rank: number;
  reasoning: string;
  analysisResult: { [key: string]: boolean };
};

export type SuggestionType = {
  _id: string;
  type: "product" | "place";
  suggestion: string;
  asin: string;
  name: string;
  image: string;
  url: string;
  rating: number;
  description: string;
  priceAndUnit: string;
  vectorizedOn: Date;
  intro?: string;
  productFeatures?: string[];
};

export type VectorizedSuggestionType = {
  suggestionId: string;
  suggestionName: string;
  name: string;
  url: string;
  rating: number;
  priceAndUnit: string;
  embeddingText: string;
  embedding: number[];
  createdAt: Date;
};

export enum PartEnum {
  FACE = "face",
  BODY = "body",
  MOUTH = "mouth",
  SCALP = "scalp",
}

export enum SexEnum {
  MALE = "male",
  FEMALE = "female",
  ALL = "all",
}

export enum SkinColorEnum {
  TYPE1 = "fitzpatrick-1",
  TYPE2 = "fitzpatrick-2",
  TYPE3 = "fitzpatrick-3",
  TYPE4 = "fitzpatrick-4",
  TYPE5 = "fitzpatrick-5",
  TYPE6 = "fitzpatrick-6",
}

export enum EthnicityEnum {
  WHITE = "white",
  ASIAN = "asian",
  BLACK = "black",
  HISPANIC = "hispanic",
  ARAB = "arab",
  SOUTH_ASIAN = "south_asian",
  NATIVE_AMERICAN = "native_american",
}

export enum SkinTypeEnum {
  DRY = "dry",
  OILY = "oily",
  NORMAL = "normal",
}

export enum AgeIntervalEnum {
  "18-24" = "18-24",
  "24-30" = "24-30",
  "30-36" = "30-36",
  "36-42" = "36-42",
  "42-48" = "42-48",
  "48-56" = "48-56",
  "56-64" = "56-64",
  "64+" = "64+",
}

export enum BodyTypeEnum {
  ECTOMORPH = "ectomorph",
  MESOMORPH = "mesomorph",
  ENDOMORPH = "endomorph",
}

export enum CategoryNameEnum {
  TASKS = "tasks",
  PROGRESSSCAN = "progressScan",
  FOODSCAN = "foodScan",
  PRODUCTS = "products",
  ADVISOR = "advisor",
  FAQ = "faq",
  PROOF = "proof",
  DIARY = "diary",
  OTHER = "other",
}

export enum RoleEnum {
  USER = "user",
  ASSISTANT = "assistant",
  SYSTEM = "system",
}

export type RunType = {
  isMini: boolean;
  content: ChatCompletionContentPart[];
  model?: string;
  responseFormat?: any;
  callback?: () => void;
};

export type AskOpenaiProps = {
  userId: string;
  seed: number;
  model?: string;
  messages: ChatCompletionMessageParam[];
  responseFormat?: any;
  isMini: boolean;
  isJson: boolean;
  functionName: string;
  categoryName: CategoryNameEnum;
};

export type SolutionType = {
  productTypes: string[];
  description: string;
  key: string;
};
