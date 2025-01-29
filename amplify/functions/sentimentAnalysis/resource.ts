import { defineFunction } from "@aws-amplify/backend";

export const sentimentAnalysis = defineFunction({
  name: "sentimentAnalysis",
  entry: "./handler.ts",
});
