var Transition = require('../../lib/transition')
  , assert     = require('assert');

var noop = function() {};
var handler = function(doc, done) {
  process.nextTick(function() {
    done(null, doc);
  });
};

var erroneousHandler = function(doc, done) {
  process.nextTick(function() {
    done(new Error('error just happened'));
  });
};

exports.testEvaluateTrueCondition = function(beforeExit) {
  var cb1 = false
    , cb2 = false;;
  var transition = new Transition('a', noop, 'b', 0, function(doc) { return doc.id === 'abc'; });
  transition.evaluateCondition({id: 'abc'}, {}, function(err, result) {
    assert.isNull(err);
    cb1 = true;
    assert.eql(true, result);
  });
  transition.evaluateCondition({id: 'cba'}, {}, function(err, result) {
    assert.isNull(err);
    cb2 = true;
    assert.eql(false, result);
  });
  beforeExit(function() {
    assert.ok(cb1);
    assert.ok(cb2);
  });
};

exports.testEvaluateMultipleConditionsWhenAllTrue = function(beforeExit) {
  var cb1 = false
    , cb2 = false;
  var transition = new Transition('a', noop, 'b', 0, [
      function(doc) { return doc.id == 'abc'; }
    , function(doc) { return doc.id.length === 3; }
  ]);
  transition.evaluateCondition({id: 'abc'}, {}, function(err, result) {
    assert.isNull(err);
    cb1 = true;
    assert.eql(true, result);
  });
  transition.evaluateCondition({id: 'cba'}, {}, function(err, result) {
    assert.isNull(err);
    cb2 = true;
    assert.eql(false, result);
  });
  
  beforeExit(function() {
    assert.ok(cb1);
    assert.ok(cb2);
  });
};

exports.testEvaluateMultipleAsyncConditionsWhenAllTrue = function(beforeExit) {
  var cb1 = false
    , cb2 = false;
  var transition = new Transition('a', noop, 'b', 0, [
      function(doc, done) {
        process.nextTick(function() {
          done(null, doc.id == 'abc');
        });
      }
    , function(doc, done) {
        process.nextTick(function() {
          done(null, doc.id.length === 3);
        });
      }
  ]);
  transition.evaluateCondition({id: 'abc'}, {}, function(err, result) {
    assert.isNull(err);
    cb1 = true;
    assert.eql(true, result);
  });
  transition.evaluateCondition({id: 'cba'}, {}, function(err, result) {
    assert.isNull(err);
    cb2 = true;
    assert.eql(false, result);
  });
  
  beforeExit(function() {
    assert.ok(cb1);
    assert.ok(cb2);
  });
};

exports.testEvaluateMultipleAsyncConditionsWhenOneTrue = function(beforeExit) {
  var cb1 = false
    , cb2 = false;
  var transition = new Transition('a', noop, 'b', 0, [
      function(doc, done) {
        process.nextTick(function() {
          done(null, doc.id == 'abc');
        });
      }
    , function(doc, done) {
        process.nextTick(function() {
          done(null, doc.id.length === 2);
        });
      }
  ]);
  transition.evaluateCondition({id: 'abc'}, {}, function(err, result) {
    assert.isNull(err);
    cb1 = true;
    assert.eql(false, result);
  });
  transition.evaluateCondition({id: 'cba'}, {}, function(err, result) {
    assert.isNull(err);
    cb2 = true;
    assert.eql(false, result);
  });
  
  beforeExit(function() {
    assert.ok(cb1);
    assert.ok(cb2);
  });
};

exports.testEvaluateMultipleConditionsWhenOneTrue = function(beforeExit) {
  var cb1 = false
    , cb2 = false;
  var transition = new Transition('a', noop, 'b', 0, [
      function(doc) { return doc.id == 'abc'; }
    , function(doc) { return doc.id.length === 2; }
  ]);
  transition.evaluateCondition({id: 'abc'}, {}, function(err, result) {
    assert.isNull(err);
    cb1 = true;
    assert.eql(false, result);
  });
  transition.evaluateCondition({id: 'cba'}, {}, function(err, result) {
    assert.isNull(err);
    cb2 = true;
    assert.eql(false, result);
  });
  
  beforeExit(function() {
    assert.ok(cb1);
    assert.ok(cb2);
  });
};

exports.testEvaluateUndefinedCondition = function(beforeExit) {
  var cb1 = false
    , cb2 = false;
  var transition = new Transition('a', noop, 'b', 0);
  transition.evaluateCondition({id: 'abc'}, {}, function(err, result) {
    assert.isNull(err);
    cb1 = true;
    assert.eql(true, result);
  });
  transition.evaluateCondition({id: 'cba'}, {}, function(err, result) {
    assert.isNull(err);
    cb2 = true;
    assert.eql(true, result);
  });
  beforeExit(function() {
    assert.ok(cb1);
    assert.ok(cb2);
  });
};

exports.testTrigger = function(beforeExit) {
  var toStateCalled = false
    , cb2 = false;
  var fromStateMock = {
      toState: function(doc, stateDoc, newState, done) {
        assert.ok(! toStateCalled);
        toStateCalled = true;
        assert.eql({id: 1, a: 2}, doc);
        assert.eql({state: 'a', meta: {}}, stateDoc);
        assert.eql('b', newState);
        process.nextTick(function() {
          done(null);
        });
      }
    , toErrorState: function(doc, stateDoc, error) {
      assert.ok(false, error.message);
    }
    , name: function() { return 'test'; }
  
  };
  var transition = new Transition(fromStateMock, handler, 'b', 0);
  transition.trigger({id: 1, a: 2}, {state: 'a'}, function(err) {
    assert.isNull(err)
    cb2 = true;
  });
  
  beforeExit(function() {
    assert.ok(toStateCalled);
    assert.ok(cb2);
  });
};

exports.testTriggerWithErrorOnHandler = function(beforeExit) {
  var cb2 = false;
  var fromStateMock = { };
  var transition = new Transition(fromStateMock, erroneousHandler, 'b', 0);
  transition.trigger({id: 1, a: 2}, {state: 'a'}, function(err) {
    assert.isNotNull(err)
    cb2 = true;
  });
  
  beforeExit(function() {
    assert.ok(cb2);
  });
};