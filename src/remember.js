const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const { MEMORIES_TABLE_NAME, MESSAGES_TABLE_NAME } = require("../config");
const { openai } = require("./openai");
const { CohereClient } = require("cohere-ai");
const logger = require("../src/logger.js")("remember");

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const port = process.env.EXPRESS_PORT;

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

/**
 * Retrieves user memories from the database.
 * @param {string} userId - The ID of the user.
 * @param {number} [limit=5] - The maximum number of memories to retrieve (default: 5).
 * @returns {Promise<Array>} - A promise that resolves to an array of user memories.
 */
async function getUserMemory(userId, limit = 5) {
  if (!userId) {
    logger.info("No userId provided to getUserMemory");
    return [];
  }
  logger.info("💾 Querying database for memories related to user:", userId);
  const { data, error } = await supabase
    .from(MEMORIES_TABLE_NAME)
    .select("*")
    .limit(limit)
    .order("created_at", { ascending: false })
    .eq("user_id", userId)
    .neq("value", "✨");

  if (error) {
    logger.info("Error fetching user memory:", error);
    return [];
  }

  return data;
}

/**
 * Retrieves a specified number of memories from the database.
 *
 * @param {number} [limit=5] - The maximum number of memories to retrieve. Default is 5.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of memory objects.
 */
async function getAllMemories(limit = 5) {
  const { data, error } = await supabase
    .from(MEMORIES_TABLE_NAME)
    .select("*")
    .limit(limit)
    .order("created_at", { ascending: false })
    .neq("value", "✨");

  if (error) {
    logger.info("Error fetching memories:", error);
    return [];
  }

  return data;
}

/**
 * Stores a memory in the database
 * @param {string} userId
 * @param {string} value
 * @returns {Promise<void>}
 */
async function storeUserMemory({ username, channel, guild }, value) {
  // first we do some checks to make sure we have the right types of data
  if (!username) {
    return logger.info("No username provided to storeUserMemory");
  }

  // if the user id is not a string, we need to error out
  if (typeof username !== "string") {
    return logger.info("username provided to storeUserMemory is not a string");
  }

  // if the value is not a string, we need to error out
  if (typeof value !== "string") {
    return logger.info("value provided to storeUserMemory is not a string");
  }

  // TODO: We need to convert the memory into an embedding using the openai embeddings API
  // and include that in the database entry
  let embedding = null;

  // TODO: Check .env for any non-openAI embedding models
  // Cohere, Voyage, etc

  // If the API keys are defined in the .env, then we should get embeddings from them and store those as well

  try {
    {embedding, embedding2, embedding3} = await memoryToEmbedding(value);
  } catch (e) {
    logger.info(e.message);
  }

  const { data, error } = await supabase
    // .from("storage")
    .from(MEMORIES_TABLE_NAME)
    .insert({
      user_id: username,
      channel_id: channel,
      value,
      embedding,
      embedding2,
      embedding3
    });

  if (error) {
    logger.info(`Error storing user memory: ${error.message}`);
  }
}

/**
 * Stores a user message in the database.
 *
 * @param {string} username - The ID of the user who sent the message.
 * @param {string} value - The content of the message.
 * @param {string} channelId - The ID of the channel where the message was sent.
 * @param {string} guildId - The ID of the guild where the message was sent.
 * @returns {Promise<object>} - A promise that resolves to the stored message data.
 */
async function storeUserMessage({ username, channel, guild }, value) {
  const { data, error } = await supabase
    // .from("messages")
    .from(MESSAGES_TABLE_NAME)
    .insert({
      user_id: username,
      channel_id: channel,
      guild_id: guild,
      value,
    });

  if (error) {
    logger.info(`Error storing user message: ${error.message}`);
  }

  return data;
}

/**
 * Retrieves the message history of a user.
 * @param {string} userId - The ID of the user.
 * @param {number} [limit=5] - The maximum number of messages to retrieve. Default is 5.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of message objects.
 */
async function getUserMessageHistory(userId, limit = 5) {
  const { data, error } = await supabase
    // .from("messages")
    .from(MESSAGES_TABLE_NAME)
    .select("*")
    .limit(limit)
    .order("created_at", { ascending: false })
    .eq("user_id", userId);

  if (error) {
    logger.info("Error fetching user message:", error);
    return null;
  }

  return data;
}

/**
 * Retrieves message history for a specific channel_id
 * @param {string} channelId - The ID of the channel.
 * @param {number} [limit=5] - The maximum number of messages to retrieve. Default is 5.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of message objects.
 */
async function getChannelMessageHistory(channelId, limit = 5) {
  const { data, error } = await supabase
    // .from("messages")
    .from(MESSAGES_TABLE_NAME)
    .select("*")
    .limit(limit)
    .order("created_at", { ascending: false })
    .eq("channel_id", channelId);

  if (error) {
    logger.info("Error fetching channel message:", error);
    return null;
  }

  return data;
}


/**
 * Embeds a string using the Voyage AI API.
 * @param {string} string - The input string to embed.
 * @param {string} [model="voyage-large-2"] - The model to use for embedding (default: "voyage-large-2").
 * @returns {Promise<object>} - A promise that resolves to the response data from the API.
 */
async function voyageEmbedding(string, model = "voyage-large-2") {
  const response = await axios.post(
    "https://api.voyageai.com/v1/embeddings",
    {
      input: string,
      model,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
    }
  );
  return response.data;
}

/**
 * Converts a string into three different embeddings using different models.
 * @param {string} string - The input string to convert into embeddings.
 * @returns {Object} An object containing three different embeddings.
 * @throws {Error} If there is an error generating any of the embeddings.
 */
async function stringToEmbedding(string) {
  const openAiEmbeddingResponse = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: string,
  });

  const [{ embedding: embedding1 }] = openAiEmbeddingResponse.data.data;

  let embedding2 = null;
  try {
    if (process.env.COHERE_API_KEY) {
      const embed = await Cohere.embed({
        texts: [memory],
        model: "embed-english-v3.0",
        inputType: "search_document",
      });
      embedding2 = embed.embeddings;
    }
  } catch (error) {
    console.error("Error generating embedding2:", error);
  }

  let embedding3 = null;
  try {
    if (process.env.VOYAGE_API_KEY) {
      const embed = await voyageEmbedding(memory, "voyage-large-2");
      embedding3 = embed.embedding;
    }
  } catch (error) {
    console.error("Error generating embedding3:", error);
  }

  return {
    embedding1,
    embedding2,
    embedding3,
  };
}

/**
 * Converts a memory into an embedding using OpenAI's text-embedding-ada-002 model.
 * @param {string} memory - The memory to convert into an embedding.
 * @returns {Promise<number[]>} - The embedding representing the memory.
 */
async function memoryToEmbedding(memory) {
  if (!memory) {
    return logger.info("No memory provided to memoryToEmbedding");
  }

  // const embeddingResponse = await openai.createEmbedding({
  //   model: "text-embedding-ada-002",
  //   input: memory,
  // });

  // const [{ embedding }] = embeddingResponse.data.data;

  const { embedding1: embedding, embedding2, embedding3 } = await stringToEmbedding(memory);

  return { embedding, embedding2, embedding3 };
}

/**
 * Retrieves relevant memories based on a query string.
 * @param {string} queryString - The query string to search for relevant memories.
 * @param {number} [limit=5] - The maximum number of memories to retrieve (default: 5).
 * @returns {Promise<Array>} - A promise that resolves to an array of relevant memories.
 */
async function getRelevantMemories(queryString, limit = 5) {
  logger.info(`Querying ${limit} relevant memories for: ${queryString}`);
  // turn the queryString into an embedding
  if (!queryString) {
    return [];
  }

  const { embedding1: embedding } = await stringToEmbedding(queryString);

  // query the database for the most relevant memories, currently this is only supported on the openai embeddings
  const { data, error } = await supabase.rpc("match_memories", {
    query_embedding: embedding,
    match_threshold: 0.78,
    match_count: limit,
  });

  if (error) {
    logger.info("Error fetching relevant user memory:", error);
    return null;
  }

  return data;
}

module.exports = {
  getUserMemory,
  getUserMessageHistory,
  storeUserMemory,
  getAllMemories,
  storeUserMessage,
  getRelevantMemories,
  getChannelMessageHistory,
};
