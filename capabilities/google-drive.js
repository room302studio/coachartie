const { google } = require("googleapis");
const { destructureArgs } = require("../helpers");

const keyfile = "coach-artie-6ea4b87e7c72.json"; // Path to JSON file
const scopes = ["https://www.googleapis.com/auth/drive.readonly"]; // Example scope

const privatekey = require(`./${keyfile}`);

const auth = new google.auth.GoogleAuth({
  keyFile: keyfile,
  scopes,
});

/**
 * Get an instance of Google Drive.
 * @returns {Promise} A promise that resolves to an instance of Google Drive.
 */
const getDriveInstance = async () => {
  const client = await auth.getClient();
  return google.drive({ version: "v3", auth: client });
};

/**
 * List all files in the Google Drive.
 * @returns {Promise} A promise that resolves to an array of file names and IDs.
 */
async function listFiles() {
  const drive = await getDriveInstance();

  return new Promise((resolve, reject) => {
    drive.files.list({}, (err, res) => {
      if (err) {
        reject(err);
      } else {
        const files = res.data.files.map(({ name, id }) => `${name} (${id})`);
        resolve(files);
      }
    });
  });
}

/** Read a Google Doc from Drive and return it as a string
 * 
 * @param {string} fileId - The ID of the file to read.
 * @returns {Promise} A promise that resolves when the file has been read.
 */

async function readDoc(fileId) {
  const drive = await getDriveInstance();

  return new Promise((resolve, reject) => {
    drive.files
      .export({ fileId, mimeType: "text/plain" }, { responseType: "stream" })
      .then((res) => {
        res.data
          .on("end", () => {
            resolve("Done reading file.");
          })
          .on("error", (error) => {
            reject(error);
          })
          .pipe(process.stdout);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Read a file from Google Drive.
 * @param {string} fileId - The ID of the file to read.
 * @returns {Promise} A promise that resolves when the file has been read.
 */
async function readFile(fileId) {
  const drive = await getDriveInstance();

  return new Promise((resolve, reject) => {
    drive.files
      .export({ fileId, mimeType: "text/plain" }, { responseType: "stream" })
      .then((res) => {
        res.data
          .on("end", () => {
            resolve("Done reading file.");
          })
          .on("error", (error) => {
            reject(error);
          })
          .pipe(process.stdout);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

const jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ["https://www.googleapis.com/auth/documents"]
);

jwtClient.authorize((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Successfully connected!");
  }
});

const docs = google.docs({ version: "v1", auth: jwtClient });

/**
 * Append a string to a Google Doc.
 * @param {string} docId - The ID of the Google Doc.
 * @param {string} text - The text to append.
 * @returns {Promise} A promise that resolves when the text has been appended.
 */
async function appendString(docId, text) {
  const doc = await docs.documents.get({ documentId: docId });
  doc.data.body.content += `\n${text}`;

  return docs.documents.update({
    documentId: docId,
    requestBody: { body: { content: doc.data.body.content } },
  });
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2] = destructureArgs(args);

    switch (method) {
      case "listFiles":
        return await listFiles();
      case "readFile":
        return await readFile(arg1);
      case "appendString":
        return await appendString(arg1, arg2);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
