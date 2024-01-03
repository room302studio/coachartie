const { google, batchUpdate} = require("googleapis");
const { destructureArgs } = require("../helpers");
const logger = require("../src/logger")

const keyFile = "./auth/coach-artie-e95c8660132f.json"; // Path to JSON file
const scopes = ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/calendar']; 


const getCalendarInstance = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes,
  });

  const client = await auth.getClient();
  return google.calendar({ version: "v3", auth: client });
};

async function accessCalendar(calendarId) {
  const calendar = await getCalendarInstance();
  // log the calendar object to see what methods are available
  logger.info(calendar);
  return calendar.calendars.get({ calendarId });
}

async function listAllCalendars() {
  try {
    const calendar = await getCalendarInstance();
    const response = await calendar.calendarList.list();
    
    if (!(response.data.items.length > 0)) {
      throw new Error('No calendars found');
    }
    
    const calendars = response.data.items.map(({ summary, id }) => `${summary} (${id})`);
    return calendars;
  } catch (error) {
    logger.error('Error occurred while listing calendars:', error);
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
  return calendar.events.insert({ calendarId, resource: event });
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

  return calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: nextWeek.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
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
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
