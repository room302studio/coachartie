// const { google } = require('googleapis');

// const keyfile = 'coach-artie-6ea4b87e7c72.json'; // Path to JSON file
// const scopes = ['https://www.googleapis.com/auth/drive.readonly']; // Example scope

// const privatekey = require(`./${keyfile}`);

// const auth = new google.auth.GoogleAuth({
//   keyFile: keyfile,
//   scopes
// });

// const getDriveInstance = async () => {
//   const client = await auth.getClient();
//   return google.drive({ version: 'v3', auth: client });
// };

// async function listFiles() {
//   const drive = await getDriveInstance();

//   drive.files.list({}, (err, res) => {
//     if (err) throw err;
//     console.log(files.length ? 'Files:' : 'No files found.');
//     res.data.files.forEach(({ name, id }) => console.log(`${name} (${id})`));
//   });
// }

// async function readFile(fileId) {
//   const drive = await getDriveInstance();

//   drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'stream' })
//     .then(res => res.data
//       .on('end', () => console.log('Done reading file.'))
//       .on('error', console.error)
//       .pipe(process.stdout)
//     )
//     .catch(console.error);
// }

// const jwtClient = new google.auth.JWT(
//   privatekey.client_email,
//   null,
//   privatekey.private_key,
//   ['https://www.googleapis.com/auth/documents']
// );

// jwtClient.authorize(err => {
//   err ? console.log(err) : console.log('Successfully connected!');
// });

// const docs = google.docs({ version: 'v1', auth: jwtClient });

// async function appendString(docId, text) {
//   const doc = await docs.documents.get({ documentId: docId });
//   doc.data.body.content += `\n${text}`;

//   await docs.documents.update({
//     documentId: docId,
//     requestBody: { body: { content: doc.data.body.content } }
//   });
// }

// module.exports = {
//   listFiles: listFiles,
//   readFile: readFile,
//   appendString: appendString
// }