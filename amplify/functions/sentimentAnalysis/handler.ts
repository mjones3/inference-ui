import type { APIGatewayProxyHandler } from "aws-lambda";
import fetch from "node-fetch";
import { DynamoDB } from "aws-sdk";

// AWS DynamoDB Configuration
const dynamoDb = new DynamoDB.DocumentClient();
const DYNAMODB_TABLE_NAME = "Tweets";

// Twitter API Configuration
const TWITTER_BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAAAcGygEAAAAATYrSyx%2BIe88r5ziUaiGFDlhRG6E%3DFRUyWMhs3zXvMomoQY4cxSYFxQfj9oGor5q5ctzcW7hwV5cuxa";

// Hugging Face API Configuration
const HUGGING_FACE_API_URL =
  "https://lsrt5bkedfuuxkrd.us-east-1.aws.endpoints.huggingface.cloud";
const HUGGING_FACE_API_TOKEN = "Bearer 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";

// Types
interface Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
}

interface Sentiment {
  label: string;
  score: number;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("event", event);

  try {
    // Parse the query parameter from the request body
    console.info("Parsing request body...");
    const body = JSON.parse(event.body || "{}");
    const query = body.query;
    if (!query) {
      console.warn("Query parameter missing in the request.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Query parameter is required." }),
      };
    }

    console.info(`Query received: "${query}"`);

    // Fetch tweets and analyze their sentiment
    const tweets = await searchTweets(query);
    console.info(`Fetched ${tweets.length} tweets for query: "${query}"`);

    const results = [];
    for (const tweet of tweets) {
      console.info(`Processing tweet ID: ${tweet.id}`);
      const sentiment = await analyzeSentiment(tweet.text);
      console.info(
        `Sentiment analysis result for tweet ID ${tweet.id}: ${JSON.stringify(
          sentiment
        )}`
      );
      await storeTweetInDynamoDB(tweet, sentiment);
      results.push({
        tweet_id: tweet.id,
        text: tweet.text,
        sentiment_label: sentiment.label,
        sentiment_score: sentiment.score,
      });
    }

    console.info("All tweets processed successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  } catch (error) {
    console.error("Error during Lambda execution:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An internal error occurred." }),
    };
  }
};

// Function to search for tweets using Twitter API
const searchTweets = async (
  query: string,
  maxResults = 10
): Promise<Tweet[]> => {
  console.info(`Searching tweets for query: "${query}"`);
  const url = "https://api.twitter.com/2/tweets/search/recent";
  const params = new URLSearchParams({
    query,
    max_results: maxResults.toString(),
    "tweet.fields": "id,text,created_at,author_id",
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Twitter API error: ${response.status} - ${await response.text()}`
    );
  }

  const data = await response.json();
  console.info(`Twitter API response: ${JSON.stringify(data)}`);
  return data.data || [];
};

// Function to analyze sentiment using Hugging Face API
const analyzeSentiment = async (text: string): Promise<Sentiment> => {
  console.info(`Analyzing sentiment for text: "${text}"`);
  const response = await fetch(HUGGING_FACE_API_URL, {
    method: "POST",
    headers: {
      Authorization: HUGGING_FACE_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    throw new Error(
      `Hugging Face API error: ${response.status} - ${await response.text()}`
    );
  }

  const result = await response.json();
  console.info(`Hugging Face API response: ${JSON.stringify(result)}`);
  if (Array.isArray(result) && result.length > 0) {
    return result[0];
  }

  return { label: "UNKNOWN", score: 0 };
};

// Function to store a tweet in DynamoDB
const storeTweetInDynamoDB = async (
  tweet: Tweet,
  sentiment: Sentiment
): Promise<void> => {
  const params = {
    TableName: DYNAMODB_TABLE_NAME,
    Item: {
      tweet_id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id,
      created_at: tweet.created_at,
      sentiment_label: sentiment.label,
      sentiment_score: sentiment.score,
    },
  };

  try {
    console.info(`Storing tweet ID: ${tweet.id} in DynamoDB.`);
    await dynamoDb.put(params).promise();
    console.info(
      `Tweet ID ${tweet.id} successfully stored with sentiment: ${sentiment.label}`
    );
  } catch (error) {
    console.error(`Error storing tweet ${tweet.id}:`, error);
    throw error;
  }
};
