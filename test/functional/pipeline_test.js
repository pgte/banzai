var Pipeline = require('../../lib/pipeline')
  , config   = require('../config')
  , queue    = require('fake-queue')()
  , stateStore = require('banzai-statestore-mem')()
  , assert   = require('assert');

var docs = {
    1: {a:1, b:2, id: 1}
  , 2: {a:3, b:4, id: 2}
  , 3: {a:5, b:6, id: 3}
};

exports.withMetaInCouch = function(beforeExit) {
  var docStore
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
    handlerCalled = true;
    assert.eql({a:3, b:4, id: 2}, doc);
    assert.eql({}, this.meta);
    done(null, doc);
  };
  
  aHandler = function(doc, done) {
    aHandlerCalled = true;
    assert.eql({a:3, b:4, id: 2}, doc);
    assert.eql({}, this.meta);
    done(null, doc);
  };
  
  docStore = {
      load: function(id, done) {
        loadFunctionCalled = true;
        assert.eql(2, id);
        assert.eql({}, this.meta);
        process.nextTick(function() {
          done(null, docs[id]);
        });
      }
    , save:   function(doc, done) {
        saveFunctionCalled = true;
        assert.eql({}, this.meta);
        process.nextTick(function() {
          assert.eql(2, doc.id);
          docs[doc.id] = doc;
          done(null);
        });
      }
  };
  
  pipeline = new Pipeline('test pipeline', {
      queue: queue
    , stateStore: stateStore
    , docStore: docStore
  });
  pipeline
    .on('initial', initialHandler, {
      success: 'a'
    , condition: function(doc) {
        conditionCalled = true;
        return true;
      }})
    .on('a', aHandler, {
        success: 'b'
    })
    .on('b', function() {
      bHandlerCalled = true;
      assert.ok(jobId);
      pipeline.stateFor(jobId, function(err, state) {
        stateHandlerCalled = true;
        assert.equal('b', state);
      })
    })
    .push({a:1, b:2, id: 2}, function(err, id) {
      calledback = true;
      assert.isNull(err);
      assert.isNotNull(id);
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