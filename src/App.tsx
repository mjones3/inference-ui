import React, { useState } from "react";
import TwitterSentimentSearch from "./TwitterSentimentSearch";
import { HuggingFaceResponse } from "./types";

async function query(data: { inputs: string }): Promise<HuggingFaceResponse[]> {
  // Get the secret using AWS Secrets Manager via Amplify
  const secrets = {
    HuggingFaceAPI: import.meta.env.VITE_HUGGINGFACE_API_KEY || "",
  };

  // Hugging Face API Configuration
  const HUGGING_FACE_API_URL =
    "https://rxrvkd3gxtl2id45.us-east-1.aws.endpoints.huggingface.cloud";
  const HUGGING_FACE_API_TOKEN = secrets.HuggingFaceAPI;

  const response = await fetch(HUGGING_FACE_API_URL, {
    headers: {
      Authorization: `Bearer ${HUGGING_FACE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(data),
  });
  const result = await response.json();
  return result;
}

const App: React.FC = () => {
  const [text, setText] = useState("");
  const [sentiment, setSentiment] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      // Call the Hugging Face Inference API with the user's input
      const response = await query({ inputs: text });
      // DistilBERT sentiment model typically returns an array of { label, score }
      if (response && response.length > 0) {
        const result = response[0];
        const { label, score } = result;
        setSentiment(`Sentiment: ${label} (Score: ${score.toFixed(2)})`);
      } else {
        setSentiment("No sentiment data returned.");
      }
    } catch (error) {
      console.error(error);
      setSentiment("Error retrieving sentiment.");
    }
  };

  return (
    <div style={{ marginTop: "3rem" }}>
      <TwitterSentimentSearch />
    </div>
  );
};

export default App;
