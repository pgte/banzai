var Pipeline = require('../../lib/pipeline')
  , assert   = require('assert');

var docs = {
    1: {a:1, b:2, id: 1}
  , 2: {a:3, b:4, id: 2}
  , 3: {a:5, b:6, id: 3}
};

exports.theWholeShebang = function(beforeExit) {
  var loadFunction
    , pipeline
    , conditionCalled = false
    , loadFunctionCalled = false
    , calledback = false
    , handlerCalled = false
    , initialHandler 
    , aHandler
    , aHandlerCalled = false;
  
  initialHandler = function(doc, done) {
    assert.ok(! handlerCalled);
    handlerCalled = true;
    assert.eql({a:3, b:4, id: 2}, doc);
    done(null);
  };
  
  aHandler = function(doc, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    assert.eql({a:3, b:4, id: 2}, doc);
    done(null);
  };
  
  loadFunction = function(id, done) {
    loadFunctionCalled = true
    process.nextTick(function() {
      assert.eql(2, id);
      done(null, docs[id]);
    });
  };
  
  pipeline = new Pipeline('test pipeline', { loadFunction: loadFunction });
  pipeline.use('memory');
  pipeline.on('initial', initialHandler, {
      success: 'a'
    , condition: function(doc) {
        conditionCalled = true;
        return true;
      }
  });

  pipeline.on('a', aHandler, {
      success: 'b'
  });
  
  pipeline.push({a:1, b:2, id: 2}, function(err, id) {
    calledback = true;
    assert.isNull(err);
    assert.equal('number', typeof(id));
  });
  
  beforeExit(function() {
    assert.ok(handlerCalled);
    assert.ok(aHandlerCalled);
    assert.ok(loadFunctionCalled);
    assert.ok(conditionCalled);
    assert.ok(calledback);
  });
};

exports.testConcurrency = function() {
  assert.ok(true);
};