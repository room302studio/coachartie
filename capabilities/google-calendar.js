const { google } = require("googleapis");
const { destructureArgs } = require("../helpers");

const keyfile = "your-keyfile.json"; // Path to JSON file
const scopes = ["https://www.googleapis.com/auth/calendar"]; // Scope for Google Calendar

const privatekey = require(`./${keyfile}`);

const auth = new google.auth.GoogleAuth({
  keyFile: keyfile,
  scopes,
});

const getCalendarInstance = async () => {
  const client = await auth.getClient();
  return google.calendar({ version: "v3", auth: client });
};

async function accessCalendar(calendarId) {
  const calendar = await getCalendarInstance();
  return calendar.calendars.get({ calendarId });
}

async function accessEvent(calendarId, eventId) {
  const calendar = await getCalendarInstance();
  return calendar.events.get({ calendarId, eventId });
}

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

async function createEvent(calendarId, event) {
  const calendar = await getCalendarInstance();
  return calendar.events.insert({ calendarId, resource: event });
}

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
    orderBy: 'startTime',
  });
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2, arg3] = destructureArgs(args);

    switch (method) {
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