import React, { useState } from "react";
import { SecretsManager } from "aws-sdk";
import TwitterSentimentSearch from "./TwitterSentimentSearch";
interface HuggingFaceResponse {
  label: string;
  score: number;
}

async function query(data: { inputs: string }): Promise<HuggingFaceResponse[]> {
  const secretsManager = new SecretsManager();

  // Function to retrieve secret from AWS Secrets Manager
  const getSecret = async (
    secretName: string
  ): Promise<Record<string, string>> => {
    try {
      const secretValue = await secretsManager
        .getSecretValue({ SecretId: secretName })
        .promise();
      if (secretValue.SecretString) {
        return JSON.parse(secretValue.SecretString); // Parse the JSON string into an object
      }
      throw new Error("Secret string is empty.");
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      throw error;
    }
  };
  const secrets = await getSecret("dev/sentiment");

  // Hugging Face API Configuration
  const HUGGING_FACE_API_URL =
    "https://lsrt5bkedfuuxkrd.us-east-1.aws.endpoints.huggingface.cloud";
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
        const { label, score } = response[0];
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
    <div style={{ maxWidth: 400, margin: "0 auto", padding: "1rem" }}>
      <label
        htmlFor="sentimentText"
        style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}
      >
        Enter text to evaluate sentiment
      </label>
      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        <textarea
          id="sentimentText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{ width: "100%", marginBottom: "0.5rem", resize: "vertical" }}
        />
        <button type="submit" style={{ width: "100%" }}>
          Submit
        </button>
      </form>

      {sentiment && (
        <div
          style={{
            border: "1px solid #ccc",
            padding: "0.5rem",
            borderRadius: "4px",
          }}
        >
          <strong>{sentiment}</strong>
        </div>
      )}

      <TwitterSentimentSearch />
    </div>
  );
};

export default App;
