import React, { useState } from "react";

interface HuggingFaceResponse {
  label: string;
  score: number;
}

async function query(data: { inputs: string }): Promise<HuggingFaceResponse[]> {
  const response = await fetch(
    "https://lsrt5bkedfuuxkrd.us-east-1.aws.endpoints.huggingface.cloud",
    {
      headers: {
        Authorization: "Bearer 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",
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(data),
    }
  );
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
    </div>
  );
};

export default App;
