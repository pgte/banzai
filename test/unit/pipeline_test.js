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

  initialHandler = function(doc, meta, done) {
    assert.ok(! handlerCalled);
    handlerCalled = true;
    assert.eql({"a":5,"b":6,"id":3}, doc);
    assert.eql({}, meta);
    done(null, doc);
  };

  aHandler = function(doc, meta, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    assert.eql({"a":5,"b":6,"id":3}, doc);
    assert.eql({}, meta);
    done(null, doc);
  };

  loadFunction = function(id, meta, done) {
    loadFunctionCalled = true;
    assert.eql(3, id);
    assert.eql({}, meta);
    process.nextTick(function() {
      done(null, docs[id]);
    });
  };

  saveFunction = function(doc, meta, done) {
    saveFunctionCalled = true;
    process.nextTick(function() {
      assert.eql(3, doc.id);
      assert.eql({}, meta);
      docs[doc.id] = doc;
      done(null);
    });
  };

  pipeline = new Pipeline('test pipeline 1', {
      load: loadFunction
    , save: saveFunction
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

  initialHandler = function(doc, meta, done) {
    assert.ok(! handlerCalled);
    assert.ok(! aHandlerCalled);
    handlerCalled = true;
    assert.eql(doc, {"a":3,"b":4,"id":2,"state":{"pipeline":"test pipeline 2","state":"initial","doc_id":2,"meta":{}}});
    assert.eql({}, meta);
    meta.i_am_here = 123;
    done(null, doc);
  };

  aHandler = function(doc, meta, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    assert.eql(doc, {"a":3,"b":4,"id":2,"state":{"pipeline":"test pipeline 2","state":"stateA","doc_id":2,"meta":{"i_am_here":123}}});
    assert.eql({i_am_here: 123}, meta);
    done(null, doc);
  };

  loadFunction = function(id, meta, done) {
    loadFunctionCalled = true;
    assert.eql(2, id);
    assert.isNotNull(meta);
    process.nextTick(function() {
      done(null, docs[id]);
    });
  };

  saveFunction = function(doc, meta, done) {
    saveFunctionCalled = true;
    assert.eql(2, doc.id);
    assert.isNotNull(meta);
    process.nextTick(function() {
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
        assert.ok(! conditionCalled);
        conditionCalled = true;
        return true;
      }
    })
    .on('stateA', aHandler, {
      success: 'stateB'
    })
    .on('stateB', function(doc, meta, done) {
      bHandlerCalled = true;
      assert.ok(jobId);
      pipeline.state(jobId, function(err, state) {
        assert.ok(! err);
        assert.equal('stateB', state);
        done(null);
      });
    })
    .push({a:3, b:4, id: 2}, function(err, id) {
      assert.isNull(err);
      assert.ok(id);
      calledback = true;
      jobId = id;
    })
    .then(function(doc) {
      assert.ok(! promiseFulfilled)
      promiseFulfilled = true;
      assert.eql(doc, {"a":3,"b":4,"id":2,"state":{"pipeline": "test pipeline 2","state":"stateB","doc_id":2,"meta":{"i_am_here":123}}});
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