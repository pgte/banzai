var Transition = require('../../lib/transition')
  , assert     = require('assert');

noop = function() {};

exports.testEvaluateTrueCondition = function() {
  var transition = new Transition('a', noop, 'b', 'c', 0, function(doc) { return doc.id === 'abc'; });
  assert.eql(true, transition.evaluateCondition({id: 'abc'}));
  assert.eql(false, transition.evaluateCondition({id: 'cba'}));
};

exports.testEvaluateMultipleConditionsWhenAllTrue = function() {
  var transition = new Transition('a', noop, 'b', 'c', 0, [
      function(doc) { return doc.id == 'abc'; }
    , function(doc) { return doc.id.length === 3; }
  ]);
  assert.eql(true, transition.evaluateCondition({id: 'abc'}));
  assert.eql(false, transition.evaluateCondition({id: 'cba'}));
};

exports.testEvaluateMultipleConditionsWhenOneTrue = function() {
  var transition = new Transition('a', noop, 'b', 'c', 0, [
      function(doc) { return doc.id == 'abc'; }
    , function(doc) { return doc.id.length === 2; }
  ]);
  assert.eql(false, transition.evaluateCondition({id: 'abc'}));
  assert.eql(false, transition.evaluateCondition({id: 'cba'}));
};

exports.testEvaluateUndefinedCondition = function() {
  var transition = new Transition('a', noop, 'b', 'c', 0);
  assert.eql(true, transition.evaluateCondition({id: 'abc'}));
  assert.eql(true, transition.evaluateCondition({id: 'cba'}));
};