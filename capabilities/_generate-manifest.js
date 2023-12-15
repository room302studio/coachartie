const fs = require('fs');
const path = require('path');

const capabilitiesDir = path.join(__dirname);

// Get all the files in the capabilities directory
const files = fs.readdirSync(capabilitiesDir);

let manifest = {};

// Loop through each file
for (const file of files) {
  // Ignore non-JavaScript files
  if (path.extname(file) !== '.js') continue;

  // Get the name of the capability (without the .js extension)
  const capabilityName = path.basename(file, '.js');

  // Build the documentation for the capability file
  import('documentation').then(documentation => {
    documentation.build([path.join(capabilitiesDir, file)], { shallow: true })
      .then(docs => {
        // Format the documentation as JSON
        return documentation.formats.json(docs);
      })
      .then(output => {
        // Parse the JSON output
        const jsonOutput = JSON.parse(output);

        // Add the capability and its documentation to the manifest
        manifest[capabilityName] = jsonOutput;

        // Write the manifest to a file
        fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
      })
      .catch(err => {
        console.error(err);
      });
  });
}