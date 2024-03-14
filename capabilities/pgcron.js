const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
dotenv.config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
);
const { destructureArgs } = require("../helpers");

/**
 * Schedule a task in Supabase.
 * @param {string} schedule - The schedule for the task.
 * @param {string} command - The command to be executed by the task.
 * @returns {Promise<void>} - A promise that resolves when the task is scheduled successfully.
 */
async function scheduleSupabaseTask(schedule, command) {
  const { data, error } = await supabase
    .rpc('schedule_task', { _schedule: schedule, _command: command })
  
  if (error) {
    console.error('Error scheduling task:', error);
    return;
  }

  console.log('Scheduled task data:', data);
}


/**
 * Lists the cron jobs currently scheduled with pg_cron in Supabase.
 * @returns {Promise<string>} A promise that resolves to a success message with the list of jobs.
 * @throws {Error} If there is an error listing the jobs.
 */
async function listJobs() {
  try {
    const { data, error } = await supabase.rpc('cron.list');

    if (error) {
      console.error('Error listing jobs with pg_cron:', error.message);
      throw error;
    }

    console.log('Successfully listed jobs:', data);
    return `Successfully listed jobs: ${data}`;
  } catch (err) {
    console.error('Failed to list jobs:', err.message);
    throw new Error('Failed to list jobs with pg_cron');
  }
}

/**
 * Deletes a job scheduled with pg_cron in Supabase.
 * @param {string} name - The name of the job to delete.
 * @returns {Promise<string>} A promise that resolves to a success message when the job is successfully deleted.
 * @throws {Error} If there is an error deleting the job.
 */
async function deleteJob(name) {
  try {
    const { data, error } = await supabase.rpc('cron.delete', { name });

    if (error) {
      console.error('Error deleting job with pg_cron:', error.message);
      throw error;
    }

    console.log('Successfully deleted job:', data);
    return `Successfully deleted job: ${name}`;
  } catch (err) {
    console.error('Failed to delete job:', err.message);
    throw new Error('Failed to delete job with pg_cron');
  }

  if (error) throw new Error(error.message);
  return `Successfully deleted job: ${name}`;
}

/**
 * Updates a job scheduled with pg_cron in Supabase.
 * @param {string} name - The name of the job to update.
 * @param {string} schedule - The new schedule for the job.
 * @param {string} command - The new command for the job.
 * @returns {Promise<string>} A promise that resolves to a success message when the job is successfully updated.
 * @throws {Error} If there is an error updating the job.
 */
async function updateJob(name, schedule, command) {
  try {
    const { data, error } = await supabase.rpc('cron.update', { name, schedule, command });

    if (error) {
      console.error('Error updating job with pg_cron:', error.message);
      throw error;
    }

    console.log('Successfully updated job:', data);
    return `Successfully updated job: ${name}`;
  } catch (err) {
    console.error('Failed to update job:', err.message);
    throw new Error('Failed to update job with pg_cron');
  }

  if (error) throw new Error(error.message);
  return `Successfully updated job: ${name}`;
}



module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2, arg3] = destructureArgs(args);
    console.log(`⚡️ Calling capability method: supabasetodo.${method}`);

    /* args is a string passed in like
      pgcron:createJob(
      "Test Webhook Call",
      "Sends a test webhook call to the specified URL at the designated time",
      "http://webhook-dev.room302.studio/api/webhook",
      "{}", // Assuming no specific headers are required
      "{}"  // Assuming no specific body is required
    ) */
    // so we also need to remove any quotes from the args if needed
    // and then parse the args into the correct types
    const processedArgs = destructureArgs(args).map((arg) => {
      if (arg.startsWith('"') && arg.endsWith('"')) {
        return arg.slice(1, -1);
      }
      // if it's an object, parse it
      if (arg.startsWith('{') && arg.endsWith('}')) {
        return JSON.parse(arg);
      }

      // if it's a number, parse it
      if (!isNaN(arg)) {
        return parseFloat(arg);
      }

      // otherwise, return the arg as is
      return arg;
    }
    );




    if (method === "createJob") {
      // return await createJob(arg1, arg2);
      // we need to use our new fancy processedArgs
      // return await createJob(processedArgs[0], processedArgs[1], processedArgs[2], processedArgs[3], processedArgs[4]);

      // lets do the simplest possible thing first
      return await scheduleSupabaseTask(processedArgs[0], processedArgs[1]);
    } else if (method === "listJobs") {
      return await listJobs();
    } else if (method === "deleteJob") {
      return await deleteJob(arg1);
    } else if (method === "updateJob") {
      return await updateJob(arg1, arg2, arg3);
    }

  },
};
