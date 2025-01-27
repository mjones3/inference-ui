import React, { useState } from "react";

const TwitterSentimentSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState("");

  const handleSearch = async () => {
    try {
      const response = await fetch("https://placeholder-url.com/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchTerm }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setResult(`Search Results: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error(error);
      setResult("An error occurred while performing the search.");
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
