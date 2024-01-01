const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const { MEMORIES_TABLE_NAME, MESSAGES_TABLE_NAME } = require("../config");
const { openai } = require("./openai");

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
);

/**
 * Retrieves user memories from the database.
 * @param {string} userId - The ID of the user.
 * @param {number} [limit=5] - The maximum number of memories to retrieve (default: 5).
 * @returns {Promise<Array>} - A promise that resolves to an array of user memories.
 */
async function getUserMemory(userId, limit = 5) {
  if (!userId) {
    console.error("No userId provided to getUserMemory");
    return [];
  }
  console.log("💾 Querying database for memories related to user:", userId);
  const { data, error } = await supabase
    .from(MEMORIES_TABLE_NAME)
    .select("*")
    .limit(limit)
    .order("created_at", { ascending: false })
    .eq("user_id", userId)
    .neq("value", "✨");

  if (error) {
    console.error("Error fetching user memory:", error);
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
    console.error("Error fetching memories:", error);
    return [];
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
    console.error("Error fetching user message:", error);
    return null;
  }

  return data;
}

/**
 * Converts a memory into an embedding using OpenAI's text-embedding-ada-002 model.
 * @param {string} memory - The memory to convert into an embedding.
 * @returns {Promise<number[]>} - The embedding representing the memory.
 */
async function memoryToEmbedding(memory) {
  if (!memory) {
    return console.error("No memory provided to memoryToEmbedding");
  }

  const embeddingResponse = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: memory,
  });

  const [{ embedding }] = embeddingResponse.data.data;

  return embedding;
}

/**
 * Stores a memory in the database
 * @param {string} userId
 * @param {string} value
 * @returns {Promise<void>}
 */
async function storeUserMemory(userId, value) {
  // first we do some checks to make sure we have the right types of data
  if (!userId) {
    return console.error("No userId provided to storeUserMemory");
  }

  // if the user id is not a string, we need to error out
  if (typeof userId !== "string") {
    return console.error("userId provided to storeUserMemory is not a string");
  }

  // if the value is not a string, we need to error out
  if (typeof value !== "string") {
    return console.error("value provided to storeUserMemory is not a string");
  }

  // TODO: We need to convert the memory into an embedding using the openai embeddings API
  // and include that in the database entry
  let embedding = null;

  try {
    embedding = await memoryToEmbedding(value);
  } catch (e) {
    console.log(e.message);
  }

  const { data, error } = await supabase
  // .from("storage")
  .from(MEMORIES_TABLE_NAME)
  .insert({
    user_id: userId,
    value,
    embedding,
  });

  if (error) {
    console.error("Error storing user memory:", error);
  }
}

/**
 * Stores a user message in the database.
 * 
 * @param {string} userId - The ID of the user who sent the message.
 * @param {string} value - The content of the message.
 * @param {string} channelId - The ID of the channel where the message was sent.
 * @param {string} guildId - The ID of the guild where the message was sent.
 * @returns {Promise<object>} - A promise that resolves to the stored message data.
 */
async function storeUserMessage(userId, value, channelId, guildId) {
  const { data, error } = await supabase
  // .from("messages")
  .from(MESSAGES_TABLE_NAME)
  .insert({    
    user_id: userId,
    value,
  });

  if (error) {
    console.error("Error storing user message:", error);
  }

  return data;
}

/**
 * Retrieves relevant memories based on a query string.
 * @param {string} queryString - The query string to search for relevant memories.
 * @param {number} [limit=5] - The maximum number of memories to retrieve (default: 5).
 * @returns {Promise<Array>} - A promise that resolves to an array of relevant memories.
 */
async function getRelevantMemories(queryString, limit = 5) {
  console.log("QUERY STRING", queryString);
  // turn the queryString into an embedding
  if (!queryString) {
    return [];
  }

  const embeddingResponse = await openai.createEmbedding({
    model: "text-embedding-ada-002",
    input: queryString,
  });

  const [{ embedding }] = embeddingResponse.data.data;

  // query the database for the most relevant memories
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: 0.78,
    match_count: limit,
  });

  if (error) {
    console.error("Error fetching relevant user memory:", error);
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
};
