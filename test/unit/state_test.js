var assert = require('assert')
  , State  = require('../../lib/state');

var noop = function() {};

exports.addsTransitions = function() {
  var state = new State('a')
    , transition;
  state.addTransition(noop, 'b', 0);
  for(var i in state.transitions) {
    transition = state.transitions[i];
    assert.equal(state, transition.fromState);
    delete transition.fromState;
    assert.equal(noop, transition.handler);
    delete transition.handler;
    assert.equal(undefined, transition.condition);
    delete transition.condition;
  }
  assert.eql([{
      "successState":"b"
    , "priority":0 }], state.transitions);
};

exports.sortsTransitions = function() {
  var state = new State('a');
  state.addTransition(noop, 'b', 0);
  state.addTransition(noop, 'b', 10);
  state.addTransition(noop, 'b', 20);
  for(var i in state.transitions) {
    transition = state.transitions[i];
    assert.equal(state, transition.fromState);
    delete transition.fromState;
    assert.equal(noop, transition.handler);
    delete transition.handler;
    assert.equal(undefined, transition.condition);
    delete transition.condition;
  }
  assert.eql([
      {"successState":"b","priority":20}
    , {"successState":"b","priority":10}
    , {"successState":"b","priority":0}
    ], state.transitions);
};

exports.handles = function(beforeExit) {
  var state   = new State('a')
    , handler
    , cb = false
    , handlerCalled = false;
    
  handler = function(doc, callback) {
    assert.ok(! handlerCalled);
    handlerCalled = true;
    assert.eql({a: 1, b: 2}, doc);
  };
  state.addTransition(handler, 'b', 0);
  state.addTransition(handler, 'c', 0);
  state.handle({a: 1, b: 2}, {state: 'a'}, function(err) {
    cb = true;
    assert.isNull(err);
  });
  
  beforeExit(function() {
    assert.ok(handlerCalled);
    assert.ok(cb);
  });
  
};

exports.toState = function(beforeExit) {
  var pipeline
    , state
    , pipelineCalled = false;
  
  pipeline = {
    _toState: function(doc, stateDoc, state) {
      pipelineCalled = true;
      assert.eql({a:1, b:2}, doc);
      assert.eql({state: 'a'}, stateDoc);
      assert.eql('b', state);
    }
  };
  state = new State('a', pipeline);
  state.toState({a:1, b:2}, {state: 'a'}, 'b');
  
  beforeExit(function() {
    assert.ok(pipelineCalled);
  });
};

exports.toErrorState = function(beforeExit) {
  var pipeline
    , state
    , toErrorStateCalled = false
    , error = new Error('hey!');
  
  pipeline = {
    _toErrorState: function(doc, stateDoc, error) {
      toErrorStateCalled = true;
      assert.eql({a:1, b:2}, doc);
      assert.eql({state: 'a'}, stateDoc);
    }
  };
  state = new State('a', pipeline);
  state.toErrorState({a:1, b:2}, {state: 'a'}, 'b', error);
  
  beforeExit(function() {
    assert.ok(toErrorStateCalled);
  });
};
