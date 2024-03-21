const fs = require("fs");
const path = require("path");

const capabilitiesDir = path.join(__dirname);

// Get all the files in the capabilities directory
const files = fs.readdirSync(capabilitiesDir);

let manifest = {};

// Loop through each file
for (const file of files) {
  // Ignore non-JavaScript files
  if (path.extname(file) !== ".js") continue;

  // Get the name of the capability (without the .js extension)
  const capabilityName = path.basename(file, ".js");

  // if the file is _template.js ignore it
  if (capabilityName === "_template") continue;

  console.log(`Generating manifest for ${capabilityName}`);

  // Build the documentation for the capability file
  import("documentation").then((documentation) => {
    documentation
      .build([path.join(capabilitiesDir, file)], { shallow: true })
      .then((docs) => {
        // Format the documentation as JSON
        return documentation.formats.json(docs);
      })
      .then((output) => {
        // Parse the JSON output
        const jsonOutput = JSON.parse(output);

        // console.log('✨ Parsed JSON', jsonOutput);

        const textManifest = parseJSDoc(jsonOutput, capabilityName);

        // Add the capability and its documentation to the manifest
        // manifest[capabilityName] = jsonOutput;
        manifest[capabilityName] = textManifest;

        // Write the manifest to a file
        fs.writeFileSync(
          "capabilities/_manifest.json",
          JSON.stringify(manifest, null, 2)
        );
      })
      .catch((err) => {
        console.error(err);
      });
  });
}

// function parseJSDoc(jsDocData, moduleName) {
//   let output = [];

//   jsDocData.forEach(func => {
//     let funcInfo = `Function: ${moduleName}:${func.name}()\n`;

//     if (func.description?.children) {
//       funcInfo += ` - ${getTextFromChildren(func.description.children)}.\n`;
//     }

//     if (func.params?.length > 0) {
//       funcInfo += `  Parameters:\n`;
//       funcInfo += func.params
//         .filter(param => param.description?.children)
//         .map(param => `  - ${param.name} (${getTextFromChildren(param.description.children)})`)
//         .join('\n');
//       funcInfo += '\n';
//     }

//     if (func.returns?.[0]?.description?.children) {
//       funcInfo += `  Returns: ${getTextFromChildren(func.returns[0].description.children)}.\n`;
//     }

//     if (func.throws?.length > 0) {
//       funcInfo += `  Exceptions:\n`;
//       funcInfo += func.throws
//         .filter(ex => ex.description?.children)
//         .map(ex => `    - ${getTextFromChildren(ex.description.children)}`)
//         .join('\n');
//       funcInfo += '\n';
//     }

//     output.push(funcInfo);
//   });

//   return output.join('\n');
// }

function parseJSDoc(jsDocData, moduleName) {
  let output = [];

  jsDocData.forEach((func) => {
    let funcInfo = {
      name: `${moduleName}:${func.name}()`,
    };

    // if this is the handleCapabilityMethod, skip it
    if (func.name === "handleCapabilityMethod") {
      return;
    }

    if (func.description?.children) {
      funcInfo.description = getTextFromChildren(func.description.children);

      if (func.returns?.[0]?.description?.children) {
        funcInfo.description += ` Returns: ${getTextFromChildren(
          func.returns[0].description.children
        )}`;
      }
    }

    if (func.params?.length > 0) {
      funcInfo.parameters = func.params
        .filter((param) => param.description?.children)
        .map((param) => {
          return {
            name: param.name,
            description: getTextFromChildren(param.description.children),
          };
        });
    }

    if (func.throws?.length > 0) {
      funcInfo.exceptions = func.throws
        .filter((ex) => ex.description?.children)
        .map((ex) => getTextFromChildren(ex.description.children));
    }

    output.push(funcInfo);
  });

  return output;
}

function getTextFromChildren(children) {
  return children
    .map((child) => child.children.map((c) => c.value).join(" "))
    .join(" ");
}
