import type { APIGatewayProxyHandler } from "aws-lambda";
import fetch from "node-fetch";
import { DynamoDB, SecretsManager } from "aws-sdk";

// AWS DynamoDB Configuration
const dynamoDb = new DynamoDB.DocumentClient();
const DYNAMODB_TABLE_NAME = "Tweets";
const HUGGING_FACE_API_URL =
  "https://rxrvkd3gxtl2id45.us-east-1.aws.endpoints.huggingface.cloud";
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

    // Fetch tweets and analyze their sentiment
    const { data: tweets, meta } = await searchTweets(
      query,
      TWITTER_BEARER_TOKEN
    );

    console.log(`Tweets: ${tweets.toString}`);

    console.info(
      `Fetched ${
        meta.result_count
      } tweets for query: "${query}". Pagination token: ${
        meta.next_token || "None"
      }`
    );

    const results = [];
    for (const tweet of tweets) {
      console.info(`Processing tweet ID: ${tweet.id}`);
      const sentiment = await analyzeSentiment(
        tweet.text,
        HUGGING_FACE_API_TOKEN
      );
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
  maxResultsPerPage = 10,
  totalResults = 5000
): Promise<TwitterApiResponse> => {
  const url = "https://api.twitter.com/2/tweets/search/recent";
  const tweets: Tweet[] = [];
  let nextToken: string | undefined = undefined;
  let fetchedResults = 0;

  while (fetchedResults < totalResults) {
    const params = new URLSearchParams({
      query,
      max_results: maxResultsPerPage.toString(),
      "tweet.fields": "id,text,created_at,author_id",
    });

    if (nextToken) {
      params.append("next_token", nextToken);
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

    const data = (await response.json()) as TwitterApiResponse;
    console.info(
      `Fetched ${data.meta.result_count} tweets. Next token: ${data.meta.next_token}`
    );

    // Append the fetched tweets to the list
    tweets.push(...data.data);
    fetchedResults += data.meta.result_count;

    // Check if there's more data to fetch
    if (data.meta.next_token) {
      nextToken = data.meta.next_token;
    } else {
      break; // No more pages to fetch
    }
  }

  return {
    data: tweets.slice(0, totalResults), // Ensure the total number does not exceed the limit
    meta: {
      newest_id: tweets[0]?.id || "",
      oldest_id: tweets[tweets.length - 1]?.id || "",
      result_count: tweets.length,
      next_token: nextToken,
    },
  };
};

// Function to analyze sentiment using Hugging Face API
const analyzeSentiment = async (
  text: string,
  HUGGING_FACE_API_TOKEN: string
): Promise<Sentiment> => {
  const response = await fetch(HUGGING_FACE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUGGING_FACE_API_TOKEN}`,
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
