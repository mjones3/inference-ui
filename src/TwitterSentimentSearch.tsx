import React, { useState } from "react";
import { TwitterSearchResponse } from "./types";

const TwitterSentimentSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const fetchTweetBatch = async (query: string) => {
    const response = await fetch(
      "https://ib1olmvkt1.execute-api.us-east-1.amazonaws.com/dev/sentiment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return (await response.json()) as TwitterSearchResponse;
  };

  const handleSearch = async () => {
    setIsFetching(true);
    setResult("");
    try {
      const allTweets: TwitterSearchResponse[] = [];

      // Fetch first batch of 390 tweets (39 requests of 10 tweets each)
      for (let i = 0; i < 39 && !isFetching; i++) {
        const data = await fetchTweetBatch(searchTerm);
        allTweets.push(data);
        setResult(`Fetched ${(i + 1) * 10} tweets out of first batch...`);
      }

      // Wait 65 seconds
      setResult("Waiting 65 seconds before fetching next batch...");
      await sleep(65000);

      // Fetch second batch of 390 tweets
      for (let i = 39; i < 78 && !isFetching; i++) {
        const data = await fetchTweetBatch(searchTerm);
        allTweets.push(data);
        setResult(`Fetched ${(i + 1) * 10} tweets out of total...`);
      }

      setResult(
        `Complete! Total tweets fetched: ${
          allTweets.length * 10
        }\n${JSON.stringify(allTweets)}`
      );
    } catch (error) {
      console.error(error);
      setResult("An error occurred while performing the search.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "1rem" }}>
      <label
        htmlFor="twitterSentimentSearch"
        style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}
      >
        Find sentiment on Twitter
      </label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          id="twitterSentimentSearch"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter a keyword or phrase"
          style={{
            flex: 1,
            padding: "0.5rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={isFetching}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>
      {result && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.5rem",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        >
          <strong>{result}</strong>
        </div>
      )}
    </div>
  );
};

export default TwitterSentimentSearch;
