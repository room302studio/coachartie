const blessed = require("blessed");
const chalk = require("chalk");

// Create a screen object.
let screen = blessed.screen({
  smartCSR: true,
  fullUnicode: true, // better line-drawing
  dockBorders: true, // automatically dock borders
  ignoreDockContrast: true, // ignore contrasting docked borders
});

// Create a log box
let logBox = blessed.log({
  top: "0%",
  left: "0%",
  width: "50%",
  height: "100%",
  tags: true,
  keys: true,
  vi: true,
  mouse: true,
  border: {
    type: "line",
  },
  style: {
    selected: {
      bg: "green",
    },
    item: {
      hover: {
        bg: "blue",
      },
    },
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    inverse: true,
  },
  label: 'Log Box', // add a label
});

// Create an error box
let errorBox = blessed.log({
  top: "0%",
  left: "50%",
  width: "50%",
  height: "100%",
  tags: true,
  keys: true,
  vi: true,
  mouse: true,
  border: {
    type: "line",
  },
  style: {
    selected: {
      bg: "red",
    },
    item: {
      hover: {
        bg: "blue",
      },
    },
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    inverse: true,
  },
  label: 'Error Box', // add a label
});

// Append our boxes to the screen.
screen.append(logBox);
screen.append(errorBox);

// Render the screen.
screen.render();

// Override console.log, console.warn, console.error
console.log = function (...args) {
  logBox.log(chalk.green(`[INFO] [${new Date().toISOString()}] ${args.join(" ")}`));
  logBox.setScrollPerc(100);
  screen.render();
};

console.warn = function (...args) {
  logBox.log(chalk.yellow(`[WARN] [${new Date().toISOString()}] ${args.join(" ")}`));
  logBox.setScrollPerc(100);
  screen.render();
};

console.error = function (...args) {
  errorBox.log(chalk.red(`[ERROR] [${new Date().toISOString()}] ${args.join(" ")}`));
  errorBox.setScrollPerc(100);
  screen.render();
};
