const fs = require("fs");
const path = require("path");
const logger = require("../src/logger.js")("generate-manifest");
const capabilitiesDir = path.join(__dirname);

// Get all the files in the capabilities directory
const files = fs.readdirSync(capabilitiesDir);

let manifest = {};

// Convert the loop to an async function to use await
async function generateManifest() {
  const documentation = await import("documentation"); // Move import outside the loop if possible

  for (const file of files) {
    if (path.extname(file) !== ".js" || file === "_template.js" || file === "_generate-manifest.js") {
      continue; // Skip non-JS, _template, and self
    }

    const capabilityName = path.basename(file, ".js");
    logger.info(`Generating manifest for ${capabilityName}`);

    try {
      const docs = await documentation.build([path.join(capabilitiesDir, file)], { shallow: true });
      const output = await documentation.formats.json(docs);
      manifest[capabilityName] = parseJSDoc(JSON.parse(output), capabilityName);
    } catch (err) {
      console.error(err);
    }
  }

  fs.writeFileSync("capabilities/_manifest.json", JSON.stringify(manifest, null, 2));
}

// Call the async function
generateManifest().then(() => {    
  console.log('Manifest generation complete.')
  process.exit(0);
}).catch(console.error);

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
          func.returns[0].description.children,
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

    // if there are any examples, properly format them and add them to the output
    if (func.examples?.length > 0) {
      funcInfo.examples = func.examples
        .map((ex) => {
          return ex.description
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n");
        })
        .join("\n");
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
