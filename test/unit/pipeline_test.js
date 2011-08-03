var Pipeline = require('../../lib/pipeline')
  , assert   = require('assert');

var docs = {
    1: {a:1, b:2, id: 1}
  , 2: {a:3, b:4, id: 2}
  , 3: {a:5, b:6, id: 3}
};

exports.theWholeShebang = function(beforeExit) {
  var loadFunction
    , saveFunction
    , pipeline
    , conditionCalled = false
    , loadFunctionCalled = false
    , saveFunctionCalled = false
    , calledback = false
    , handlerCalled = false
    , initialHandler 
    , aHandler
    , aHandlerCalled = false
    , bHandlerCalled = false
    , stateHandlerCalled = false
    , jobId;
  
  initialHandler = function(doc, done) {
    assert.ok(! handlerCalled);
    handlerCalled = true;
    assert.eql({a:3, b:4, id: 2}, doc);
    done(null, doc);
  };
  
  aHandler = function(doc, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    assert.eql({a:3, b:4, id: 2}, doc);
    done(null, doc);
  };
  
  loadFunction = function(id, done) {
    loadFunctionCalled = true;
    assert.eql(2, id);
    process.nextTick(function() {
      done(null, docs[id]);
    });
  };
  
  saveFunction = function(doc, done) {
    saveFunctionCalled = true;
    process.nextTick(function() {
      assert.eql(2, doc.id);
      docs[doc.id] = doc;
      done(null);
    });
  };
  
  pipeline = new Pipeline('test pipeline', {
      load: loadFunction
    , save: saveFunction
  });
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
  
  pipeline.on('b', function() {
    bHandlerCalled = true;
    assert.ok(jobId);
    pipeline.stateFor(jobId, function(err, state) {
      stateHandlerCalled = true;
      assert.equal('b', state);
    })
  });
  
  pipeline.push({a:1, b:2, id: 2}, function(err, id) {
    calledback = true;
    assert.isNull(err);
    assert.equal('number', typeof(id));
    jobId = id;
  });
  
  beforeExit(function() {
    assert.ok(handlerCalled);
    assert.ok(aHandlerCalled);
    assert.ok(bHandlerCalled);
    assert.ok(stateHandlerCalled);
    assert.ok(loadFunctionCalled);
    assert.ok(saveFunctionCalled);
    assert.ok(conditionCalled);
    assert.ok(calledback);
  });
};

exports.testConcurrency = function() {
  assert.ok(true);
};