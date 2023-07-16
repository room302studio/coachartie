const { destructureArgs } = require('./helpers');

function handleCapabilityMethod(args) {
  const [operation, ...numbers] = destructureArgs(args);

  switch (operation) {
    case 'add':
      return numbers.reduce((a, b) => +a + +b, 0);
    case 'subtract':
      return numbers.reduce((a, b) => +a - +b);
    case 'multiply':
      return numbers.reduce((a, b) => +a * +b);
    case 'divide':
      return numbers.reduce((a, b) => +a / +b);
    case 'pow':
      return numbers.reduce((a, b) => Math.pow(+a, +b));
    case 'sqrt':
      return numbers.reduce((a, b) => Math.sqrt(+a));
    case 'log':
      return numbers.reduce((a, b) => Math.log(+a));
    default:
      throw new Error('Invalid operation');
  }
}

module.exports = {
  handleCapabilityMethod
};