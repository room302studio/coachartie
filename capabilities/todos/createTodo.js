// createTodo.js
import { supabase } from './supabaseClient';

/**
 * Creates a new todo item in the database.
 * 
 * @param {Object} todoDetails - Details of the todo to be created.
 * @param {number} todoDetails.projectId - ID of the project the todo belongs to.
 * @param {string} todoDetails.name - Name of the todo.
 * @param {string} [todoDetails.description] - Description of the todo (optional).
 * @param {string} [todoDetails.status='To Do'] - Status of the todo (optional, defaults to 'To Do').
 * @param {string} [todoDetails.priority] - Priority of the todo (optional).
 * @param {Date} [todoDetails.dueDate] - Due date of the todo (optional).
 * @param {Array<string>} [todoDetails.externalUrls=[]] - External URLs related to the todo (optional).
 * @param {Array<string>} [todoDetails.attachments=[]] - Attachment URLs related to the todo (optional).
 * @returns {Promise<Object>} A promise that resolves to the created todo item.
 */
async function createTodo({
    projectId,
    name,
    description = '',
    status = 'To Do',
    priority = '',
    dueDate = null,
    externalUrls = [],
    attachments = [],
}) {
    const { data, error } = await supabase.from('todos').insert([{
        project_id: projectId,
        name,
        description,
        status,
        priority,
        due_date: dueDate,
        external_urls: externalUrls,
        attachments,
    }]);

    if (error) throw new Error(error.message);
    return data[0];
}
/*
This capability allows for the creation of a new todo item within a specified project. It supports optional details such as description, status, priority, due date, external URLs, and attachments, making it flexible for various use cases. The function defaults to setting the todo's status to "To Do" if not specified, ensuring a new todo is actionable immediately upon creation.

When to Use: Use this capability when a new task arises that needs tracking within a project's context. It's suitable for user-driven todo creation based on input or automated task generation from project activities or milestones.

How to Use:

Prepare Todo Details: Construct an object containing the details of the todo to be created, including the mandatory projectId and name fields, along with any other optional information.
Call the Function: Invoke the createTodo function with the prepared object. Handle the promise returned by the function to deal with the newly created todo or to catch any errors.
Process Response: On successful creation, use the returned todo item for display, further processing, or confirmation to the user.
*/