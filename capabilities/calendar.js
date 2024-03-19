const { google, batchUpdate } = require("googleapis");
const { destructureArgs } = require("../helpers");
const logger = require("../src/logger.js")("capabilities");
const dotenv = require("dotenv");
dotenv.config();

const keyFile = `./${process.env.GOOGLE_KEY_PATH}`;
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const getCalendarInstance = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes,
  });

  const client = await auth.getClient();
  return google.calendar({
    version: "v3",
    auth: client,
    project: process.env.GOOGLE_PROJECT_NUMBER,
  });
};

async function accessCalendar(calendarId) {
  const calendar = await getCalendarInstance();
  // log the calendar object to see what methods are available
  logger.info(calendar);
  return calendar.calendars.get({ calendarId });
}

/**
 * Retrieves a list of all calendars.
 * @returns {Promise<string[]>} An array of calendar summaries and IDs.
 * @description This function uses the Google Calendar API to retrieve a list of all calendars available to the authenticated user.
 * @throws {Error} If no calendars are found or an error occurs.
 */
async function listAllCalendars() {
  try {
    const calendar = await getCalendarInstance();
    logger.info("Calendar instance:", calendar);
    const response = await calendar.calendarList.list();
    logger.info("Response from listAllCalendars:" + JSON.stringify(response));

    if (!(response.data.items.length > 0)) {
      throw new Error("No calendars found", response.data);
    }

    const calendars = response.data.items.map(
      ({ summary, id }) => `${summary} (${id})`
    );
    return calendars;
  } catch (error) {
    logger.info("Error occurred while listing calendars:" + error);
    throw error;
  }
}

/**
 * Retrieves a specific event from a Google Calendar.
 * @param {string} calendarId - The ID of the calendar.
 * @param {string} eventId - The ID of the event.
 * @returns {Promise<object>} - A promise that resolves to the event object.
 */
async function accessEvent(calendarId, eventId) {
  const calendar = await getCalendarInstance();
  return calendar.events.get({ calendarId, eventId });
}

/**
 * Adds a person to an event in the Google Calendar.
 *
 * @param {string} calendarId - The ID of the calendar.
 * @param {string} eventId - Th e ID of the event.
 * @param {string} attendeeEmail - The email address of the attendee to be added.
 * @returns {Promise} - A promise that resolves to the updated event.
 */
async function addPersonToEvent(calendarId, eventId, attendeeEmail) {
  const calendar = await getCalendarInstance();
  const event = await calendar.events.get({ calendarId, eventId });

  event.data.attendees.push({ email: attendeeEmail });

  return calendar.events.update({
    calendarId,
    eventId,
    resource: event.data,
  });
}

/**
 * Creates a new event in the specified calendar.
 * @param {string} calendarId - The ID of the calendar.
 * @param {object} event - The event object to be created.
 * @returns {Promise<object>} - A promise that resolves to the created event.
 */
async function createEvent(calendarId, event) {
  const calendar = await getCalendarInstance();
  const insert = calendar.events.insert({ calendarId, resource: event });

  // share the event with everyone @room302.studio
  const batch = calendar.newBatch();
  batch.add(
    calendar.acl.insert({
      calendarId,
      requestBody: {
        role: "reader",
        scope: {
          type: "group",
          value: "room302.studio",
        },
      },
    })
  );

  await batch.execute();

  return insert;
}

/**
 * Retrieves a list of events occurring within the current week for the specified calendar.
 * @param {string} calendarId - The ID of the calendar to retrieve events from.
 * @returns {Promise<object>} - A promise that resolves to the list of events.
 */
async function listEventsThisWeek(calendarId) {
  const calendar = await getCalendarInstance();
  const now = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  const response = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: nextWeek.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return JSON.stringify(response);
}

// TODO: listEventsPrevWeek
/**
 * Retrieves a list of events occurring within the previous week for the specified calendar.
 * @param {string} calendarId - The ID of the calendar to retrieve events from.
 * @returns {Promise<object>} - A promise that resolves to the list of events.
 */
async function listEventsPrevWeek(calendarId) {
  const calendar = await getCalendarInstance();
  const now = new Date();
  const prevWeek = new Date();
  prevWeek.setDate(now.getDate() - 7);

  const response = await calendar.events.list({
    calendarId,
    timeMin: prevWeek.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return JSON.stringify(response);
}

/**
  * Retrieves a list of events occurring between the specified dates for the specified calendar.
  * @param {string} calendarId - The ID of the calendar to retrieve events from.
  * @param {Date} startDate - The start date of the range.
  * @param {Date} endDate - The end date of the range.
  * @returns {Promise<object>} - A promise that resolves to the list of events.
 */
async function listEventsBetweenDates(calendarId, startDate, endDate) {
  const calendar = await getCalendarInstance();
  const response = await calendar.events.list({
    calendarId,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return JSON.stringify(response);
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2, arg3] = destructureArgs(args);

    switch (method) {
      case "listAllCalendars":
        return await listAllCalendars();
      case "accessCalendar":
        return await accessCalendar(arg1);
      case "accessEvent":
        return await accessEvent(arg1, arg2);
      case "addPersonToEvent":
        return await addPersonToEvent(arg1, arg2, arg3);
      case "createEvent":
        return await createEvent(arg1, arg2);
      case "listEventsThisWeek":
        return await listEventsThisWeek(arg1);
      case "listEventsPrevWeek":
        return await listEventsPrevWeek(arg1);
      case "listEventsBetweenDates":
        return await listEventsBetweenDates(arg1, arg2, arg3);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
