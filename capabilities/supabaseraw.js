const { destructureArgs } = require("../helpers");
const { supabase } = require("../src/supabaseclient");
const logger = require("../src/logger.js")("capabilities");



/**
 * Executes a SELECT query on the specified table with the given columns and conditions.
 * @param {string} table - The name of the table to select from.
 * @param {string[]} columns - An array of column names to include in the result.
 * @param {object} where - An object representing the conditions to filter the result.
 * @returns {Promise<any>} - A promise that resolves to the result of the SELECT query.
 * @example supabaseraw:select("todos", "*", { id: 1 })
 * @example supabaseraw:select("todos", ["id", "title"], { completed: false })
 * @example supabaseraw:select("config", "*", { CONFIG_KEY: "CHAT_MODEL" })
 */
async function select(table, columns, where) {
  const { data, error } = await supabase
    .from(table)
    .select(columns, { ...where });

  if (error) {
    console.error("Error running SQL query:", error.message);
    return `Error running SQL query: ${error.message}`;
  }
  return data;
}

/**
 * Executes an INSERT query on the specified table with the given values.
 * @param {string} table - The name of the table to insert into.
 * @param {object} values - An object representing the values to insert.
 * @returns {Promise<any>} - A promise that resolves to the result of the INSERT query.
 * @example supabaseraw:insert("todos", { value: "Buy groceries", completed: false })
 */
async function insert(table, values) {
  const { data, error } = await supabase
    .from(table)
    .insert(values);

  if (error) {
    console.error("Error running SQL query:", error.message);
    return `Error running SQL query: ${error.message}`;
  }
  return data;
}

/**
 * Executes an UPDATE query on the specified table with the given values and conditions.
 * @param {string} table - The name of the table to update.
 * @param {object} values - An object representing the values to update.
 * @param {object} where - An object representing the conditions to filter the update.
 * @returns {Promise<any>} - A promise that resolves to the result of the UPDATE query.
 * @example supabaseraw:update("todos", { completed: true }, { id: 1 })
 * Say you want to update a prompt in the prompt table, you can do:
 * @example supabaseraw:update("prompts", "new prompt text", { prompt_name: "PROMPT_SYSTEM" })
 */
async function update(table, values, where) {
  const { data, error } = await supabase
    .from(table)
    .update(values, { ...where });

  if (error) {
    console.error("Error running SQL query:", error.message);
    return `Error running SQL query: ${error.message}`;
  }
  return data;
}

/**
 * Executes a DELETE query on the specified table with the given conditions.
 * @param {string} table - The name of the table to delete from.
 * @param {object} where - An object representing the conditions to filter the delete.
 * @returns {Promise<any>} - A promise that resolves to the result of the DELETE query.
 * @example supabaseraw:delete("todos", { id: 1 })
 */
async function del(table, where) {
  return 'Delete not implemented yet.'
  const { data, error } = await supabase
    .from(table)
    .delete({ ...where });

  if (error) {
    console.error("Error running SQL query:", error.message);
    return `Error running SQL query: ${error.message}`;
  }
  return data;
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    // const desArgs = destructureArgs(args);
    // const [arg1, arg2] = desArgs;
    const [arg1, arg2, arg3] = destructureArgs(args);
    logger.info(
      `⚡️ Calling capability method: supabasetodo.${method} with args: ${arg1}, ${arg2}, ${arg3}`
    );

    if (method === "select") {
      return await select(arg1, JSON.parse(arg2), JSON.parse(arg3));
    } else if (method === "insert") {
      return await insert(arg1, JSON.parse(arg2));
    } else if (method === "update") {
      return await update(arg1, JSON.parse(arg2), JSON.parse(arg3));
    } else if (method === "delete") {
      return await del(arg1, JSON.parse(arg2));      
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
};
