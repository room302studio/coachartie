// deleteTodo.js
import { supabase } from './supabaseClient';

/**
 * Deletes a todo item from the database.
 * 
 * @param {number} todoId - ID of the todo to be deleted.
 * @returns {Promise<boolean>} A promise that resolves to true if the deletion was successful, false otherwise.
 */
async function deleteTodo(todoId) {
    const { data, error } = await supabase
        .from('todos')
        .delete()
        .match({ id: todoId });

    if (error) {
        console.error('Error deleting todo:', error.message);
        return false;
    }
    return true;
}
/*
This capability allows for the deletion of a specified todo item from the database. It is a straightforward function that requires only the ID of the todo item to be deleted. This capability is essential for maintaining the relevance and accuracy of the todo list by removing completed, cancelled, or outdated tasks.

When to Use: Utilize this capability when a todo item is no longer needed or relevant. This could be after the completion of a task, cancellation of a project, or any situation where a todo does not need to be tracked anymore.

How to Use:

Determine Todo ID: Identify the ID of the todo item that needs to be deleted.
Call the Function: Execute the deleteTodo function with the identified todo ID. Manage the promise to address any errors and confirm deletion.
Verify Deletion: The function returns a boolean value indicating the success of the deletion operation. Use this to provide feedback to the user or to update the application state accordingly.
*/