const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const { destructureArgs } = require("../helpers");
const { openai } = require("../src/openai");

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function handleCapabilityMethod(method, args) {
  const [arg1, arg2] = destructureArgs(args);

  switch (method) {
    case "getUserMemory":
      return getUserMemory(arg1, arg2);
    case "getUserMessageHistory":
      return getUserMessageHistory(arg1, arg2);
    case "storeUserMemory":
      return storeUserMemory(arg1, arg2);
    case "getAllMemories":
      return getAllMemories(arg1);
    case "storeUserMessage":
      return storeUserMessage(arg1, arg2);
    case "isRememberResponseFalsy":
      return isRememberResponseFalsy(arg1);
    default:
      throw new Error(`Method ${method} not supported by Supabase capability.`);
  }
}

async function getUserMemory(userId, limit = 5) {
  if (!userId) {
    console.error("No userId provided to getUserMemory");
    return [];
  }
  console.log("💾 Querying database for memories related to user:", userId);
  const { data, error } = await supabase
    .from("storage")
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

async function getAllMemories(limit = 5) {
  const { data, error } = await supabase
    .from("storage")
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

async function getUserMessageHistory(userId, limit = 5) {
  const { data, error } = await supabase
    .from("messages")
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

  const { data, error } = await supabase.from("storage").insert({
    user_id: userId,
    value,
    embedding,
  });

  if (error) {
    console.error("Error storing user memory:", error);
  }
}

/**
 * Stores a message in the database
 * @param {string} userId
 * @param {string} value
 * @returns {Promise<void>}
 */

async function storeUserMessage(userId, value) {
  const { data, error } = await supabase.from("messages").insert({
    user_id: userId,
    value,
  });

  if (error) {
    console.error("Error storing user message:", error);
  }

  return data;
}

// Given a message, return the last 5 memories and the last 5 messages
async function assembleMemory(user, memoryCount = 5) {
  try {
    if(!user) {
      console.error("No user provided to assembleMemory");
      return [];
    }
    // Get the last X memories for the current user
    const memories = await getUserMemory(user, memoryCount);

    console.log(' assembling memories for user: ', memories);

    // get X random memories
    // const randomMemories = await getRandomMemories(randomMemoryCount);

    // Concat the memories and messages
    const memory = [
      ...new Set([
        ...memories.map(mem => mem.value)
        // ...randomMemories,
      ]),
    ];

    return memory;
  } catch (e) {
    console.error("assembleMemory error: ", e);
  }
}

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

function isRememberResponseFalsy(args) {
  const [response] = destructureArgs(args);

  const lowerCaseResponse = response.toLocaleLowerCase();

  if (lowerCaseResponse === "no" || lowerCaseResponse === "no.") {
    return true;
  }

  if (
    lowerCaseResponse.includes("no crucial") ||
    lowerCaseResponse.includes("no important") ||
    lowerCaseResponse.includes("✨")
  ) {
    return true;
  }

  if (lowerCaseResponse.includes("no key details")) {
    return true;
  }
}

module.exports = {
  handleCapabilityMethod,
  getUserMemory,
  getUserMessageHistory,
  storeUserMemory,
  getAllMemories,
  storeUserMessage,
  isRememberResponseFalsy,
  getRelevantMemories,
};
