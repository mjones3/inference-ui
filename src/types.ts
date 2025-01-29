export interface HuggingFaceResponse {
  label: string;
  score: number;
}

export interface TwitterSearchResponse {
  tweets: string[];
  sentiments: HuggingFaceResponse[];
}