const { destructureArgs } = require("../helpers");
const logger = require("../src/logger")('capability-supabasetodo')
/**
 * Creates a new todo item in the database. This capability allows for the creation of a new todo item within a specified project. It supports optional details such as description, status, priority, due date, external URLs, and attachments, making it flexible for various use cases. The function defaults to setting the todo's status to "To Do" if not specified, ensuring a new todo is actionable immediately upon creation.
 * When to Use: Use this capability when a new task arises that needs tracking within a project's context. It's suitable for user-driven todo creation based on input or automated task generation from project activities or milestones.
 * How to Use:
 * Prepare Todo Details: Construct an object containing the details of the todo to be created, including the mandatory projectId and name fields, along with any other optional information.
 * Call the Function: Invoke the createTodo function with the prepared object. Handle the promise returned by the function to deal with the newly created todo or to catch any errors.
 * Process Response: On successful creation, use the returned todo item for display, further processing, or confirmation to the user.
 *
 * @param {string} name - The name of the todo item.
 * @param {string} description - The description of the todo item.
 * @returns {Promise<string>} A promise that resolves to a success message.
 */
async function createTodo(name, description = "") {
  const { supabase } = require("../src/supabaseclient");
  const { data, error } = await supabase.from("todos").insert([
    {
      name,
      description,
    },
  ]);

  if (error) throw new Error(error.message);
  return `Successfully added todo: ${name}`;
}
// deleteTodo.js

/**
 * Deletes a todo item from the database.
 * This capability allows for the deletion of a specified todo item from the database. It is a straightforward function that requires only the ID of the todo item to be deleted. This capability is essential for maintaining the relevance and accuracy of the todo list by removing completed, cancelled, or outdated tasks.
 * When to Use: Utilize this capability when a todo item is no longer needed or relevant. This could be after the completion of a task, cancellation of a project, or any situation where a todo does not need to be tracked anymore.
 * How to Use:
 * Determine Todo ID: Identify the ID of the todo item that needs to be deleted.
 * Call the Function: Execute the deleteTodo function with the identified todo ID. Manage the promise to address any errors and confirm deletion.
 * Verify Deletion: The function returns a boolean value indicating the success of the deletion operation. Use this to provide feedback to the user or to update the application state accordingly.
 *
 * @param {number} todoId - ID of the todo to be deleted.
 * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful, false otherwise.
 */
async function deleteTodo(todoId) {
  const { supabase } = require("../src/supabaseclient");
  const { data, error } = await supabase
    .from("todos")
    .delete()
    .match({ id: todoId });

  if (error) {
    console.error("Error deleting todo:", error.message);
    return `Error deleting todo with ID: ${todoId} ${error.message}`;
  }
  return `Successfully deleted todo with ID: ${todoId}`;
}
/*

*/

/**
 * Updates an existing todo item in the database.
 *
 * @param {number} todoId - ID of the todo to be updated.
 * @param {Object} updates - Object containing the fields to update.
 * @returns {Promise<Object>} A promise that resolves to the updated todo item.
 */
async function updateTodo(todoId, updates) {
  const { supabase } = require("../src/supabaseclient");
  const { data, error } = await supabase
    .from("todos")
    .update(updates)
    .match({ id: todoId });

  if (error) throw new Error(error.message);
  return data[0];
}
/*
This capability enables updating specific fields of an existing todo item, such as its status, priority, or due date. It allows partial updates, making it flexible for reflecting changes in todo items over time without needing to specify the entire todo details.

When to Use: Use this capability when there's a need to modify an existing todo item, such as marking it as completed, updating its due date, or changing its priority based on new information or project changes.

How to Use:

Identify Todo and Changes: Determine the ID of the todo you wish to update and prepare an object with the fields that need updating.
Call the Function: Invoke the updateTodo function with the todo ID and the updates object. Handle the promise to catch any potential errors.
Process Response: Use the updated todo item returned by the function to verify the updates and inform the user or further application logic.
*/

/* list todo function */

/**
 * Lists all todo items in the database.
 * This capability allows for the retrieval of all todo items from the database. It is a simple function that returns an array of all todo items, which can be used for display, processing, or further manipulation.
 * When to Use: Utilize this capability when you need to display all the todo items in a project, or when you need to process or manipulate the entire list of todos.
 * How to Use:
 * Call the Function: Execute the listTodos function. Handle the promise to catch any errors and process the array of todo items returned.
 * Process Response: Use the array of todo items for display, processing, or further manipulation as needed.
 * @param {number} projectId - ID of the project to list todos for.
 * @returns {Promise<Object[]>} A promise that resolves to an array of all todo items.
 *
 */
async function listTodos() {
  const { supabase } = require("../src/supabaseclient");
  const { data, error } = await supabase.from("todos").select("*");

  if (error) throw new Error(error.message);
  return JSON.stringify(data);
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    // const desArgs = destructureArgs(args);
    // const [arg1, arg2] = desArgs;
    const [arg1, arg2] = destructureArgs(args);
    logger.info(`⚡️ Calling capability method: supabasetodo.${method}
    
    ${JSON.stringify(args)}`);

    if (method === "createTodo") {
      // const todoJsonString = arg1
      // const todoJson = JSON.parse(todoJsonString);
      /*{"name":"Implement priority labels for todos", "description":"Add priority labels such as High, Medium, Low to each todo item for better task prioritization."}*/
      // pull the name out of the json and use it to create the todo
      // const name = todoJson.name;
      const res = await createTodo(arg1);
      return res;
    } else if (method === "deleteTodo") {
      return await deleteTodo(arg1);
    } else if (method === "updateTodo") {
      return await updateTodo(arg1);
    } else if (method === "listTodos") {
      return await listTodos();
    } else {
      throw new Error(`Invalid method: ${method}`);
    }
  },
  listTodos,
  createTodo,
  deleteTodo,
  updateTodo,
};
