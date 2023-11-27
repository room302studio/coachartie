const fs = require('fs');
const path = require('path');
const { parse } = require('comment-parser');

const capabilitiesDir = path.join(__dirname, 'capabilities');
const manifestFile = path.join(__dirname, 'capabilities', '_manifest.js');

let manifest = {
  capabilities: []
};

fs.readdirSync(capabilitiesDir).forEach(file => {
  if (file === '_manifest.js') return;

  const filePath = path.join(capabilitiesDir, file);
  if (fs.statSync(filePath).isDirectory()) return;

  const fileContent = fs.readFileSync(filePath, 'utf8');

  const parsedComments = parse(fileContent);

  parsedComments.forEach(comment => {
    console.log('comment', comment);
    const capability = {
      slug: file.replace('.js', ''),
      description: comment.description,
      methods: comment.tags.map(tag => ({
        name: tag.name,
        description: tag.description,
        parameters: tag.type ? [{ name: tag.type.name, description: tag.type.description }] : []
      }))
    };

    manifest.capabilities.push(capability);
  });
});

fs.writeFileSync(manifestFile, `module.exports = ${JSON.stringify(manifest, null, 2)}`);

