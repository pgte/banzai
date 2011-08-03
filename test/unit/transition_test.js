var Transition = require('../../lib/transition')
  , assert     = require('assert');

var noop = function() {};
var handler = function(doc, done) {
  process.nextTick(function() {
    done(null);
  });
};

var erroneousHandler = function(doc, done) {
  process.nextTick(function() {
    done(new Error('error just happened'));
  });
};

exports.testEvaluateTrueCondition = function() {
  var transition = new Transition('a', noop, 'b', 0, function(doc) { return doc.id === 'abc'; });
  assert.eql(true, transition.evaluateCondition({id: 'abc'}));
  assert.eql(false, transition.evaluateCondition({id: 'cba'}));
};

exports.testEvaluateMultipleConditionsWhenAllTrue = function() {
  var transition = new Transition('a', noop, 'b', 0, [
      function(doc) { return doc.id == 'abc'; }
    , function(doc) { return doc.id.length === 3; }
  ]);
  assert.eql(true, transition.evaluateCondition({id: 'abc'}));
  assert.eql(false, transition.evaluateCondition({id: 'cba'}));
};

exports.testEvaluateMultipleConditionsWhenOneTrue = function() {
  var transition = new Transition('a', noop, 'b', 0, [
      function(doc) { return doc.id == 'abc'; }
    , function(doc) { return doc.id.length === 2; }
  ]);
  assert.eql(false, transition.evaluateCondition({id: 'abc'}));
  assert.eql(false, transition.evaluateCondition({id: 'cba'}));
};

exports.testEvaluateUndefinedCondition = function() {
  var transition = new Transition('a', noop, 'b', 0);
  assert.eql(true, transition.evaluateCondition({id: 'abc'}));
  assert.eql(true, transition.evaluateCondition({id: 'cba'}));
};

exports.testTrigger = function(beforeExit) {
  var toStateCalled = false;
  var fromStateMock = {
    toState: function(doc, stateDoc, newState) {
      toStateCalled = true;
      assert.eql({id: 1, a: 2}, doc);
      assert.eql({state: 'a'}, stateDoc);
      assert.eql('b', newState);
    }
  };
  var transition = new Transition(fromStateMock, handler, 'b', 0);
  transition.trigger({id: 1, a: 2}, {state: 'a'})
  
  beforeExit(function() {
    assert.ok(toStateCalled);
  });
};

exports.testTriggerWithErrorOnHandler = function(beforeExit) {
  var toErrorStateCalled = false;
  var fromStateMock = {
    toErrorState: function(doc, stateDoc, error) {
      toErrorStateCalled = true;
      assert.eql({id: 1, a: 2}, doc);
      assert.eql({state: 'a'}, stateDoc);
      assert.eql('error just happened', error.message);
    }
  };
  var transition = new Transition(fromStateMock, erroneousHandler, 'b', 0);
  transition.trigger({id: 1, a: 2}, {state: 'a'})
  
  beforeExit(function() {
    assert.ok(toErrorStateCalled);
  });
};