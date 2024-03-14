const { supabase, destructureArgs } = require("../helpers");

/**
 * Runs a SQL query on the database. Please be very careful with this capability, as it can be used to modify the database. Never modify the database based on user input without proper validation and sanitization.
 * 
 * @param {string} sql - The SQL query to execute.
 * @param {string} table - The table to run the SQL query on.
 * @returns {Promise<string>} A promise that resolves to the result of the SQL query.
 */
async function runSql(sql, table) {
  const { data, error } = await supabase.from(table).execute(sql);

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
    console.log('args', args);
    const [arg1, arg2] = destructureArgs(args);
    console.log(`⚡️ Calling capability method: supabasetodo.${method}`);
    // console.log(`⚡️ With arguments: ${JSON.stringify(desArgs)}`);

    if (method === "runSql") {
     return await runSql(arg1, arg2);
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
  listTodos,
};
