const { handleCapabilityMethod } = require("./calculator");
const assert = require('assert');

describe('Calculator', function() {
  describe('#handleCapabilityMethod()', function() {
    it('should return 3 when the operation is add and the numbers are 1 and 2', function() {
      assert.equal(handleCapabilityMethod(['add', '1', '2']), 3);
    });
    it('should return -1 when the operation is subtract and the numbers are 1 and 2', function() {
      assert.equal(handleCapabilityMethod(['subtract', '1', '2']), -1);
    });
    it('should return 2 when the operation is multiply and the numbers are 1 and 2', function() {
      assert.equal(handleCapabilityMethod(['multiply', '1', '2']), 2);
    });
    it('should return 0.5 when the operation is divide and the numbers are 1 and 2', function() {
      assert.equal(handleCapabilityMethod(['divide', '1', '2']), 0.5);
    });
    it('should return 1 when the operation is pow and the numbers are 1 and 2', function() {
      assert.equal(handleCapabilityMethod(['pow', '1', '2']), 1);
    });
    it('should return 1 when the operation is sqrt and the number is 1', function() {
      assert.equal(handleCapabilityMethod(['sqrt', '1']), 1);
    });
    it('should return 0 when the operation is log and the number is 1', function() {
      assert.equal(handleCapabilityMethod(['log', '1']), 0);
    });
    it('should throw error when the operation is invalid', function() {
      assert.throws(() => handleCapabilityMethod(['invalid', '1', '2']), Error);
    });
  });
});
