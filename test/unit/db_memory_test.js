var DB = require('../../lib/db')
  , memory = DB.findByType('memory')
  , assert = require('assert');

module.exports.testCreate = function(beforeExit) {
  var calledback = false;
  memory.create({a: 1, b: 2}, function(err, data) {
    calledback = true;
    assert.isNull(err);
    assert.isNotNull(data);
    assert.ok(!! data.id);
  });
  beforeExit(function() {
    assert.ok(calledback);
  })
};

module.exports.testGet = function(beforeExit) {
  var calledback = false;
  memory.create({a: 1, b: 2}, function(err, data) {
    memory.get(data.id, function(err, retData) {
      calledback = true;
      assert.isNull(err);
      assert.ok(!! retData);
      assert.eql(data, retData);
    });
  });
  beforeExit(function() {
    assert.ok(calledback);
  })
};

module.exports.testSet = function(beforeExit) {
  var calledback = false;
  memory.create({a: 1, b: 2}, function(err, data) {
    memory.update(data.id, {a: 3, b: 4}, function(err) {
      assert.isNull(err);
      memory.get(data.id, function(err, retData) {
        assert.isNull(err);
        calledback = true;
        assert.ok(!! retData);
        assert.eql({id: data.id, a:3, b:4}, retData);
      });
    });
  });
  beforeExit(function() {
    assert.ok(calledback);
  })
};