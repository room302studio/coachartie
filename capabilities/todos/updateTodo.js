// updateTodo.js
import { supabase } from './supabaseClient';

/**
 * Updates an existing todo item in the database.
 * 
 * @param {number} todoId - ID of the todo to be updated.
 * @param {Object} updates - Object containing the fields to update.
 * @returns {Promise<Object>} A promise that resolves to the updated todo item.
 */
async function updateTodo(todoId, updates) {
    const { data, error } = await supabase
        .from('todos')
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