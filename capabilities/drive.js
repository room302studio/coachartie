const { google, batchUpdate } = require("googleapis");
const { destructureArgs } = require("../helpers");
const logger = require("../src/logger")("drive")
require("dotenv").config();
const keyFile = `./${process.env.GOOGLE_KEY_PATH}`
const scopes = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
];

/**
 * Get an instance of Google Drive.
 * @returns {Promise} A promise that resolves to an instance of Google Drive.
 */
const getDriveInstance = async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes,
  });

  // console log the scopes we are authed into
  // logger.info('auth.scopes are: ');
  // logger.info(auth.scopes);

  const client = await auth.getClient();
  return google.drive({ version: "v3", auth: client });
};

/**
 * List all files in the Google Drive.
 * @returns {Promise} A promise that resolves to an array of file names and IDs.
 */
async function listFiles() {
  try {
    const drive = await getDriveInstance();

    return new Promise((resolve, reject) => {
      drive.files.list({}, (err, res) => {
        if (err) {
          reject(err);
        } else {
          if (res.data.files.length === 0) {
            reject(new Error("No files found."));
          } else {
            const files = res.data.files.map(
              ({ name, id }) => `${name} (${id})`,
            );
            resolve(files);
          }
        }
      });
    });
  } catch (error) {
    logger.info(error);
    if (error.code === "AUTH_ERROR") {
      throw new Error("Authentication problem.");
    } else {
      throw error;
    }
  }
}

/** Read a Google Doc from Drive and return it as a string
 *
 * @param {string} fileId - The ID of the file to read.
 * @returns {Promise} A promise that resolves when the file has been read.
 */

async function readDoc(fileId) {
  const drive = await getDriveInstance();
  let fileContent = "";

  return new Promise((resolve, reject) => {
    drive.files
      .export({ fileId, mimeType: "text/plain" }, { responseType: "stream" })
      .then((res) => {
        res.data
          .on("data", (chunk) => {
            fileContent += chunk;
          })
          .on("end", () => {
            resolve(fileContent);
          })
          .on("error", (error) => {
            reject(error);
          });
      })
      .catch((error) => {
        reject(error);
      });

    return fileContent;
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

async function shareFile(fileId, email) {
  const drive = await getDriveInstance();

  return new Promise((resolve, reject) => {
    drive.permissions
      .create({
        fileId,
        requestBody: {
          role: "writer",
          type: "user",
          emailAddress: email,
        },
      })
      .then((res) => {
        resolve(res);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

async function appendString(fileId, text) {
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
 *
 * @param {string} title - The title of the new document.
 * @param {string} text - The text to use as the content of the new document.
 */
async function createNewDocument(title, text) {
  const drive = await getDriveInstance();

  // Create a new Google Doc
  const docMetadata = {
    name: title,
    mimeType: "application/vnd.google-apps.document",
  };

  const createdDoc = await drive.files.create({
    resource: docMetadata,
    media: {
      mimeType: "text/plain",
      body: text,
    },
  });

  // share the file with everyone in the organization
  await drive.permissions.create({
    fileId: createdDoc.data.id,
    requestBody: {
      role: "writer",
      type: "domain",
      domain: "room302.studio", // Replace with your actual domain
    },
  });

  return JSON.stringify(createdDoc.data);
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2] = destructureArgs(args);

    switch (method) {
      case "listFiles":
        return await listFiles();
      case "readDoc":
        return await readDoc(arg1);
      case "readFile":
        return await readFile(arg1);
      case "appendString":
        return await appendString(arg1, arg2);
      case "createNewDocument":
        return await createNewDocument(arg1, arg2);
      case "shareFile":
        return await shareFile(arg1, arg2);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  },
};
