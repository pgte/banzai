var assert = require('assert')
  , State  = require('../../lib/state');

var noop = function() {};

exports.handles = function(beforeExit) {
  var pipeline = {
          toState: function(doc, stateDoc, state, done) {
            toStateCalled = true;
            process.nextTick(function() {
              done(null);
            });
          }
      }
    , state   = new State('a', pipeline)
    , handler
    , cb = false
    , handlerCalled = false
    , toStateCalled = false;
    
  handler = function(doc, callback) {
    assert.ok(! handlerCalled);
    handlerCalled = true;
    assert.eql({a: 1, b: 2}, doc);
    assert.eql({}, this.meta);
    callback(null);
  };
  state.addTransition(handler, 'b', 0);
  state.addTransition(handler, 'c', 0);
  state.handle({a: 1, b: 2}, {state: 'a'}, function(err) {
    cb = true;
    assert.isNull(err);
  });
  
  beforeExit(function() {
    assert.ok(toStateCalled);
    assert.ok(handlerCalled);
    assert.ok(cb);
  });
  
};

exports.toState = function(beforeExit) {
  var pipeline
    , state
    , pipelineCalled = false;
  
  pipeline = {
      toState: function(doc, stateDoc, state) {
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