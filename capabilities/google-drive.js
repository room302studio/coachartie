const { google } = require('googleapis');
const { destructureArgs } = require('./helpers');

const keyfile = 'coach-artie-6ea4b87e7c72.json'; // Path to JSON file
const scopes = ['https://www.googleapis.com/auth/drive.readonly']; // Example scope

const privatekey = require(`./${keyfile}`);

const auth = new google.auth.GoogleAuth({
  keyFile: keyfile,
  scopes
});

const getDriveInstance = async () => {
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client });
};

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

async function readFile(fileId) {
  const drive = await getDriveInstance();

  return new Promise((resolve, reject) => {
    drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'stream' })
      .then(res => {
        res.data
          .on('end', () => {
            resolve('Done reading file.');
          })
          .on('error', error => {
            reject(error);
          })
          .pipe(process.stdout);
      })
      .catch(error => {
        reject(error);
      });
  });
}

const jwtClient = new google.auth.JWT(
  privatekey.client_email,
  null,
  privatekey.private_key,
  ['https://www.googleapis.com/auth/documents']
);

jwtClient.authorize(err => {
  if (err) {
    console.log(err);
  } else {
    console.log('Successfully connected!');
  }
});

const docs = google.docs({ version: 'v1', auth: jwtClient });

async function appendString(docId, text) {
  const doc = await docs.documents.get({ documentId: docId });
  doc.data.body.content += `\n${text}`;

  return docs.documents.update({
    documentId: docId,
    requestBody: { body: { content: doc.data.body.content } }
  });
}

module.exports = {
  handleCapabilityMethod: async (method, args) => {
    const [arg1, arg2] = destructureArgs(args);

    switch (method) {
      case 'listFiles':
        return await listFiles();
      case 'readFile':
        return await readFile(arg1);
      case 'appendString':
        return await appendString(arg1, arg2);
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  }
};