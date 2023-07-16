const blessed = require("blessed");

// Create a screen object.
let screen = blessed.screen();

// Create first log box
let log1 = blessed.box({
  top: "10%",
  left: "left",
  width: "50%",
  height: "90%",
  content: "",
  tags: true,
  border: {
    type: "line",
  },
  style: {
    fg: "white",
    bg: "black",
    border: {
      fg: "#f0f0f0",
    },
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    inverse: true,
  },
});

// Create second log box
let log2 = blessed.box({
  top: "10%",
  left: "50%",
  width: "50%",
  height: "40%",
  content: "",
  tags: true,
  // border: {
  //   type: 'line'
  // },
  style: {
    fg: "red",
    bg: "black",
    // border: {
    //   fg: '#f0f0f0'
    // }
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    inverse: true,
  },
});

// create a third log box in the lower right
let log3 = blessed.box({
  top: "50%",
  left: "50%",
  width: "50%",
  height: "50%",
  content: "",
  tags: true,
  // border: {
  //   type: 'line'
  // },
  style: {
    fg: "blue",
    bg: "black",
    // border: {
    //   fg: '#f0f0f0'
    // }
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    ch: " ",
    inverse: true,
  },
});

// make a fourth box that takes up the top 10% of the screen
let log4 = blessed.box({
  top: "top",
  left: "left",
  width: "100%",
  height: "10%",
  content: "",
  tags: true,
  style: {
    fg: "black",
    bg: "white",
  },
});

// Append our boxes to the screen.
screen.append(log1);
screen.append(log2);
screen.append(log3);
screen.append(log4);

// Focus on first log box
log1.focus();

// Render the screen.
screen.render();

// steal console.log and send it to log1
const oldLog = console.log;

console.log = function (...args) {
  // oldLog(...args);
  log1.insertBottom(args.join(" "));
  // scroll to bottom
  log1.setScrollPerc(100);
  screen.render();
};

function consolelog2(...args) {
  log2.insertBottom(args.join(" "));
  // scroll to bottom
  log2.setScrollPerc(100);
  screen.render();
}

// set console.error to log2
console.error = consolelog2;

function consolelog3(...args) {
  // log3.insertBottom(args.join(' '));
  // // scroll to bottom
  // log3.setScrollPerc(100);

  // actually, reset the log3 box and fill with the new content
  log3.setContent(args.join(" "));

  screen.render();
}

consolelog4 = function (...args) {
  log4.setContent(args.join(" "));
  screen.render();
};

module.exports = {
  consolelog2,
  consolelog3,
  consolelog4,
  screen,
  log1,
  log2,
  log3,
  log4,
};
