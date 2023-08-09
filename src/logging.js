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
    bg: "white",
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
  // scrollable: true,
  // alwaysScroll: true,
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

// console.log = function (...args) {
//   // oldLog(...args);
//   log1.insertBottom(args.join(" "));
//   // scroll to bottom
//   log1.setScrollPerc(100);
//   screen.render();
// };

// refactor to divert logs to the correct screen based on emoji
// 🤖 = consolelog2
// 📝 = consolelog3
// 🧠 = log1
// 🔧 = consolelog3
console.log = function (...args) {
  // grab the emoji from the first argument
  // let emoji = args[0].slice(0, 2);
  // need to slice the emoji out of the first argument using regex
  // const emoji = args[0].match(/[\u{1F600}-\u{1F6FF}]/u)[0];
  // if the emoji is 🤖, send it to log2
  // if (emoji === "🤖") {
  //   consolelog2(...args);
  // } else if (emoji === "📝") {
  //   consolelog3(...args);
  // } else if (emoji === "🧠") {
  //   oldLog(...args);
  // } else if (emoji === "🔧") {
  //   consolelog4(...args);
  // } else {
  //   // otherwise, send it to log1
  //   log1.insertBottom(args.join(" "));
  //   // scroll to bottom
  //   log1.setScrollPerc(100);
  //   screen.render();
  // }

  // need to use regex to find matches instead
  // if the emoji is 🤖, send it to log2
  // if (args[0].match(/[\u{1F916}]/u)) {
  // wanna use the emoji directly in the regex
  if (args[0].match(/🤖/u)) {
    consolelog2(...args);
  } else if (args[0].match(/📝/u)) {
    consolelog3(...args);
  } else if (args[0].match(/🧠/u)) {
    consolelog3(...args);
  } else if (args[0].match(/🔧/u)) {
    consolelog4(...args);
  } else {
    log1.insertBottom(args.join(" "));
    // scroll to bottom
    log1.setScrollPerc(100);
    screen.render();
  }
};

function consolelog2(...args) {
  log2.insertBottom(args.join(" "));
  // scroll to bottom
  log2.setScrollPerc(100);
  screen.render();
}

// set console.error to log2
// console.error = consolelog2;

// make a bright red pop up window for errors
const errorBox = blessed.box({
  top: "center",
  left: "center",
  width: "50%",
  height: "50%",
  content: "",
  tags: true,
  border: {
    type: "line",
  },
  style: {
    fg: "red",
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

// use the error box for console.error
console.error = function (...args) {
  errorBox.setContent(args.join(" "));
  screen.append(errorBox);
  screen.render();
};

// add the ability to close the error box
// errorBox.key(["escape"], function (ch, key) {
//   errorBox.detach();
//   screen.render();
// });

function consolelog3(...args) {
  // log3.insertBottom(args.join(' '));
  // // scroll to bottom
  // log3.setScrollPerc(100);

  // actually, reset the log3 box and fill with the new content
  // log3.setContent(args.join(" "));
  log3.insertBottom(args.join(" "));
  log3.setScrollPerc(100);
  screen.render();
}

consolelog4 = function (...args) {
  log4.setContent(args.join(" "));
  // log4.setScrollPerc(100);
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
