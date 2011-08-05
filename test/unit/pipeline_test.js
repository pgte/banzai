var Pipeline = require('../../lib/pipeline')
  , assert   = require('assert');

var docs = {
    1: {a:1, b:2, id: 1}
  , 2: {a:3, b:4, id: 2}
  , 3: {a:5, b:6, id: 3}
};

setTimeout(function() {
  process.exit();
}, 10000);

exports.withMetaInMemory = function(beforeExit) {
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
    assert.eql({"a":5,"b":6,"id":3}, doc);
    done(null, doc);
  };

  aHandler = function(doc, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    assert.eql({"a":5,"b":6,"id":3}, doc);
    done(null, doc);
  };

  loadFunction = function(id, done) {
    loadFunctionCalled = true;
    assert.eql(3, id);
    process.nextTick(function() {
      done(null, docs[id]);
    });
  };

  saveFunction = function(doc, done) {
    saveFunctionCalled = true;
    process.nextTick(function() {
      assert.eql(3, doc.id);
      docs[doc.id] = doc;
      done(null);
    });
  };

  pipeline = new Pipeline('test pipeline 1', {
      load: loadFunction
    , save: saveFunction
    , log: console.log
  });
  pipeline
    .use('memory')
    .on('initial', initialHandler, {
      success: 'a'
    , condition: function(doc) {
        conditionCalled = true;
        return true;
      }
    })
    .on('a', aHandler, {
      success: 'b'
    })
    .on('b', function() {
      bHandlerCalled = true;
      pipeline.state(jobId, function(err, state) {
        assert.isNull(err);
        stateHandlerCalled = true;
        assert.equal('b', state);
      });
    })
    .push({a:1, b:2, id: 3}, function(err, id) {
      calledback = true;
      jobId = id;
      assert.isNull(err);
      assert.equal('number', typeof(id));
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

exports.withoutMeta = function(beforeExit) {
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
    , promiseFulfilled = false
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
    assert.eql({a:3, b:4, id:2, state: {state: "stateA", doc_id: 2}}, doc);
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

  pipeline = new Pipeline('test pipeline 2', {
      load: loadFunction
    , save: saveFunction
  });
  pipeline
    .on('initial', initialHandler, {
      success: 'stateA'
    , condition: function(doc) {
        conditionCalled = true;
        return true;
      }
    })
    .on('stateA', aHandler, {
      success: 'stateB'
    })
    .on('stateB', function() {
      bHandlerCalled = true;
      assert.ok(jobId);
      console.log('.state');
      pipeline.state(jobId, function(err, state) {
        console.log(state);
        assert.ok(! err);
        assert.equal('stateB', state);
      });
    })
    .push({a:1, b:2, id: 2}, function(err, id) {
      console.log('pushed');
      assert.isNull(err);
      assert.ok(id);
      calledback = true;
      jobId = id;
    })
    .then(function(doc) {
      promiseFulfilled = true;
      assert.eql({"a":3,"b":4,"id":2,"state":{"state":"stateB","doc_id":2}}, doc);
    })
    .error(function(err) {
      assert.ok(false, err);
    });

  beforeExit(function() {
    assert.ok(handlerCalled);
    assert.ok(aHandlerCalled);
    assert.ok(bHandlerCalled);
    assert.ok(loadFunctionCalled);
    assert.ok(saveFunctionCalled);
    assert.ok(conditionCalled);
    assert.ok(calledback);
    assert.ok(promiseFulfilled);
  });    
};

exports.withCustomMeta = function(beforeExit) {
  assert.ok(false);
};