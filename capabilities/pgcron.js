const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
dotenv.config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY,
  { db: { schema: 'cron' } }
);
const { destructureArgs } = require("../helpers");

/**
 * Creates a new cron job with pg_cron in Supabase.
 * @param {string} schedule - The schedule for the cron job (e.g., '0 0 * * *' for daily at midnight).
 * @param {string} command - The command to be executed by the cron job.
 * @returns {Promise<{ data: any, error: Error | null }>} - A promise that resolves with the result of the cron job creation.
 */
async function createJob(schedule, command) {
  const randomJobName = `job-${Math.floor(Math.random() * 1000000)}`;
  const { data, error } = await supabase
    .rpc('schedule', {
      command: command,
      job_name: randomJobName,
      schedule: schedule
    });

  if (error) {
    console.error('Error creating job with pg_cron:', error);
    throw error;
  }

  console.log('Job created:', data);
  return `Job created: ${data}`;
}

/**
 * Lists the cron jobs currently scheduled with pg_cron in Supabase.
 * @returns {Promise<{ data: any, error: Error | null }>} A promise that resolves with the list of cron jobs.
 */
async function listJobs() {
  try {
    const { data, error } = await supabase
      .from('job')
      .select('*')
      .limit(100);

    if (error) {
      console.error('Error listing jobs with pg_cron:', error);
      throw error;
    }

    console.log('Jobs:', data);
    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.error("Failed to list jobs:", err.message);
    throw new Error("Failed to list jobs with pg_cron");
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
    const { data, error } = await supabase.rpc("cron.delete", { name });

    if (error) {
      console.error("Error deleting job with pg_cron:", error.message);
      throw error;
    }

    console.log("Successfully deleted job:", data);
    return `Successfully deleted job: ${name}`;
  } catch (err) {
    console.error("Failed to delete job:", err.message);
    throw new Error("Failed to delete job with pg_cron");
  }
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
    const { data, error } = await supabase.rpc("cron.update", {
      name,
      schedule,
      command,
    });

    if (error) {
      console.error("Error updating job with pg_cron:", error.message);
      throw error;
    }

    console.log("Successfully updated job:", data);
    return `Successfully updated job: ${name}`;
  } catch (err) {
    console.error("Failed to update job:", err.message);
    throw new Error("Failed to update job with pg_cron");
  }
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
      if (arg.startsWith("{") && arg.endsWith("}")) {
        return JSON.parse(arg);
      }

      // if it's a number, parse it
      if (!isNaN(arg)) {
        return parseFloat(arg);
      }

      // otherwise, return the arg as is
      return arg;
    });

    if (method === "createJob") {
      return await createJob(processedArgs[0], processedArgs[1]);
    } else if (method === "listJobs") {
      return await listJobs();
    } else if (method === "deleteJob") {
      return await deleteJob(arg1);
    } else if (method === "updateJob") {
      return await updateJob(arg1, arg2, arg3);
    }
  },
};