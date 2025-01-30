/* eslint-disable no-constant-condition */
import type { APIGatewayProxyHandler } from "aws-lambda";
import fetch from "node-fetch";
import { DynamoDB, SecretsManager } from "aws-sdk";

// AWS DynamoDB Configuration
const dynamoDb = new DynamoDB.DocumentClient();
const DYNAMODB_TABLE_NAME = "Tweets";
const HUGGING_FACE_API_URL =
  "https://api-inference.huggingface.co/models/distilbert/distilbert-base-uncased-finetuned-sst-2-english";
const secretsManager = new SecretsManager();

// Function to retrieve secrets from AWS Secrets Manager
const getSecret = async (
  secretName: string
): Promise<Record<string, string>> => {
  try {
    const secretValue = await secretsManager
      .getSecretValue({ SecretId: secretName })
      .promise();
    if (secretValue.SecretString) {
      return JSON.parse(secretValue.SecretString);
    }
    throw new Error("Secret string is empty.");
  } catch (error) {
    console.error(`Failed to retrieve secret ${secretName}:`, error);
    throw error;
  }
};

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

interface TwitterApiResponse {
  data: Tweet[];
  meta: {
    newest_id: string;
    oldest_id: string;
    result_count: number;
    next_token?: string;
  };
}

// Lambda handler
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("Event received:", event);

  try {
    // Fetch secrets at runtime
    const secrets = await getSecret("dev/sentiment");
    const TWITTER_BEARER_TOKEN = secrets.TwitterBearerToken;
    const HUGGING_FACE_API_TOKEN = secrets.HuggingFaceAPI;

    // Parse the query parameter from the request body
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

    // Initialize results array
    const results = [];
    let nextToken: string | undefined;
    let totalProcessed = 0;
    const maxTotalTweets = 30;
    // Process tweets in batches
    do {
      // Fetch one page of tweets
      console.info("Fetching tweets from Twitter API...");
      const response = await searchTweets(
        query,
        TWITTER_BEARER_TOKEN,
        10,
        nextToken
      );

      const { data: tweets, meta } = response;

      console.info(
        `Fetched ${
          meta.result_count
        } tweets for query: "${query}". Pagination token: ${
          meta.next_token || "None"
        }`
      );

      // Process this batch of tweets
      for (const tweet of tweets) {
        console.info(`Processing tweet ID: ${tweet.id}`);

        try {
          console.info(`Sending text to Hugging Face API: "${tweet.text}"`);

          // Ensure this function does not move forward until the sentiment API responds
          const sentiment = await analyzeSentiment(
            tweet.text,
            HUGGING_FACE_API_TOKEN
          );

          // Verify sentiment is valid before storing
          if (!sentiment || !sentiment.label) {
            console.warn(
              `Skipping tweet ${tweet.id} due to missing sentiment.`
            );
            continue; // Skip storing this tweet if sentiment is not valid
          }

          console.info(
            `Sentiment analysis result for tweet ID ${
              tweet.id
            }: ${JSON.stringify(sentiment)}`
          );

          // Store the tweet and sentiment in DynamoDB
          await storeTweetInDynamoDB(tweet, sentiment);
          console.info(`Stored tweet ${tweet.id} successfully.`);

          results.push({
            tweet_id: tweet.id,
            text: tweet.text,
            sentiment_label: sentiment.label,
            sentiment_score: sentiment.score,
          });
        } catch (error) {
          console.error(`Error processing tweet ${tweet.id}:`, error);
        }
      }

      totalProcessed += tweets.length;
      nextToken = meta.next_token;

      // Break if we've processed enough tweets or there are no more tweets
      if (totalProcessed >= maxTotalTweets || !nextToken) {
        break;
      }
    } while (true);

    console.info("All tweets processed successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error during Lambda execution:", error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "An internal error occurred.",
          details: error.message,
        }),
      };
    }
    console.error("Unknown error during Lambda execution:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "An unknown error occurred." }),
    };
  }
};

// Function to search for tweets using Twitter API
const searchTweets = async (
  query: string,
  TWITTER_BEARER_TOKEN: string,
  maxResults: number,
  nextPageToken?: string
): Promise<TwitterApiResponse> => {
  const url = "https://api.twitter.com/2/tweets/search/recent";

  const params = new URLSearchParams({
    query,
    max_results: maxResults.toString(),
    "tweet.fields": "id,text,created_at,author_id",
  });

  if (nextPageToken) {
    params.append("next_token", nextPageToken);
  }

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

  return (await response.json()) as TwitterApiResponse;
};

// Function to analyze sentiment using Hugging Face API

const analyzeSentiment = async (
  text: string,
  HUGGING_FACE_API_TOKEN: string
): Promise<Sentiment | null> => {
  console.info(`Sending text to Hugging Face API: "${text}"`);

  const response = await fetch(HUGGING_FACE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUGGING_FACE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    console.error(
      `Hugging Face API Error: ${response.status} - ${await response.text()}`
    );
    return null;
  }

  const result = await response.json();
  console.info(`Hugging Face API Response: ${JSON.stringify(result)}`);

  // Fix: Extract sentiment correctly from the nested structure
  if (
    Array.isArray(result) &&
    result.length > 0 &&
    Array.isArray(result[0]) &&
    result[0].length > 0
  ) {
    // Find the sentiment with the highest score
    const bestSentiment = result[0].reduce(
      (max, item) => (item.score > max.score ? item : max),
      result[0][0]
    );
    return bestSentiment;
  }

  console.warn("Unexpected Hugging Face response format:", result);
  return null;
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

  console.info(`Storing tweet in DynamoDB: ${JSON.stringify(params.Item)}`);

  try {
    await dynamoDb.put(params).promise();
    console.info(`Tweet ${tweet.id} stored successfully.`);
  } catch (error) {
    console.error(`Error storing tweet ${tweet.id}:`, error);
    throw error;
  }
};
