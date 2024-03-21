const { google } = require("googleapis");
const { destructureArgs } = require("../helpers");
const { eachDayOfInterval, set, format } = require("date-fns");

require("dotenv").config();
const keyFile = `./${process.env.GOOGLE_KEY_PATH}`;
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/**
 * Google Auth object
 */
const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes,
});

const getCalendarInstance = async () => {
  const client = await auth.getClient();
  return google.calendar({ version: "v3", auth: client });
};

/**
 * Function to find potential meeting times within a specified interval
 * @param {String} emailString - Space-separated list of emails to check for availability, escape any commas in the list
 * @param {String} timeMin - Start of time interval in human readable format
 * @param {String} timeMax - End of time interval in human readable format
 * @description This function uses the Google Calendar API to find potential meeting times within the specified interval
 * @returns {Promise} Array of potential meeting times
 */
async function findPotentialMeetingTimes(emailString, timeMin, timeMax) {
  // Get an instance of the Google Calendar API
  const calendar = await getCalendarInstance();

  const emails = emailString.split(" ");

  // Map the emails to an array of objects with id as the email
  const items = emails.map((email) => ({ id: email }));

  // Convert human readable time to JavaScript Date objects
  const timeMinDate = new Date(timeMin);
  const timeMaxDate = new Date(timeMax);

  // Query the freebusy API to get the busy times for the specified emails within the time interval
  // timeMin and timeMax should be JavaScript Date objects. They will be converted to ISO strings.
  const response = await calendar.freebusy.query({
    resource: {
      timeMin: timeMinDate.toISOString(), // Converts the Date object to an ISO string
      timeMax: timeMaxDate.toISOString(), // Converts the Date object to an ISO string
      items,
    },
  });

  // Extract the busy times from the response
  const busyTimes = response.data.calendars;

  // Get an array of each day within the time interval
  const days = eachDayOfInterval({ start: timeMinDate, end: timeMaxDate });
  const potentialTimes = [];

  // Loop through each day and each hour from 10 to 18
  for (const day of days) {
    for (let hour = 10; hour <= 18; hour++) {
      // Set the potential time to the current day and hour
      const potentialTime = set(day, { hours: hour, minutes: 0, seconds: 0 });
      // Format the potential time to a string in the format "yyyy-MM-dd'T'HH:mm:ss"
      const formattedTime = format(potentialTime, "yyyy-MM-dd'T'HH:mm:ss");

      // If none of the busy times overlap with the potential time, add it to the potential times array
      if (
        !busyTimes.some(
          (time) => time.start <= formattedTime && time.end >= formattedTime,
        )
      ) {
        potentialTimes.push(formattedTime);
      }
    }
  }

  // Return the array of potential times
  return potentialTimes;
}

/**
 * Exports an object with a method to handle capability methods
 */
module.exports = {
  /**
   * Function to handle capability methods
   * @param {String} method - The method to handle
   * @param {Array} args - The arguments for the method
   * @returns {Promise} The result of the method
   */
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2, arg3] = destructureArgs(args);

    switch (method) {
      case "findPotentialMeetingTimes":
        return await findPotentialMeetingTimes(arg1, arg2, arg3);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
