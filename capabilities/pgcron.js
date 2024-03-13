const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
dotenv.config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
);
const { destructureArgs } = require("../helpers");

/**
 * Creates a new job using pg_cron to schedule it in Supabase.
 * @param {string} name - The name of the job.
 * @param {string} [description=""] - The description of the job (optional).
 * @param {string} webhookUrl - The URL to send the HTTP POST request.
 * @param {Object} [headers={}] - The headers to include in the HTTP POST request (optional).
 * @param {Object} [body={}] - The body of the HTTP POST request (optional).
 * @returns {Promise<string>} A promise that resolves to a success message when the job is successfully scheduled.
 * @throws {Error} If there is an error scheduling the job.
 */
async function createJob(name, description = "", webhookUrl, headers = {}, body = {}) {
  // Utilizing pg_cron to schedule a new job in Supabase
  const schedule = '0 * * * *'; // Example schedule: At the start of every hour
  const jobCommand = `SELECT net.http_post(
    url:='${webhookUrl}', 
    headers:='${JSON.stringify(headers)}'::jsonb, 
    body:=jsonb_build_object(${JSON.stringify(body).replace(/"/g, "'")})
  )`;

  try {
    const { data, error } = await supabase.rpc('cron.schedule', {
      name,
      schedule,
      command: jobCommand,
    });

    if (error) {
      console.error('Error scheduling job with pg_cron:', error.message);
      throw error;
    }

    console.log('Successfully scheduled job:', data);
  } catch (err) {
    console.error('Failed to schedule job:', err.message);
    throw new Error('Failed to schedule job with pg_cron');
  }

  if (error) throw new Error(error.message);
  return `Successfully added job: ${name}`;
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
    console.log(`⚡️ With arguments: ${JSON.stringify(desArgs)}`);

    if (method === "createJob") {
      return await createJob(arg1, arg2);
    } else if (method === "listJobs") {
      return await listJobs();
    } else if (method === "deleteJob") {
      return await deleteJob(arg1);
    } else if (method === "updateJob") {
      return await updateJob(arg1, arg2, arg3);
    }

  },
};
