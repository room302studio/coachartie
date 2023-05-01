/*

    {
      slug: 'calculator',
      description: 'This capability gives you the ability to do math.',
      methods: [
        {
          name: 'calculate',
          description: 'This method gives you the ability to add, subtract, multiply, and divide numbers.',
          returns: 'number',
          parameters: [
            {
              name: 'operation',
              type: 'string',
              description: 'The operation to perform. Can be "add", "subtract", "multiply", or "divide".'
            },
            {
              name: 'numbers',
              type: 'array',
              description: 'An array of numbers to perform the operation on.'
            }
          ]
        },

  */

 function calculate(args) {
  // the args are comma-separated
  // the first arg is the operation
  // the rest of the args are the numbers
  const [operation, ...numbers] = args.split(', ');

  console.log('operation: ', operation);
  console.log('numbers: ', numbers);

  if (operation === 'add') {
    return numbers.reduce((a, b) => +a + +b, 0);
  } else if (operation === 'subtract') {
    return numbers.reduce((a, b) => +a - +b);
  } else if (operation === 'multiply') {
    return numbers.reduce((a, b) => +a * +b);
  } else if (operation === 'divide') {
    return numbers.reduce((a, b) => +a / +b);
  }
}

module.exports = {
  calculate
}

