var inspect = require('util').inspect
  , Pipeline = require('../../lib/pipeline')
  , assert   = require('assert')
  , queue    = require('fake-queue')()
  , stateStore = require('banzai-statestore-mem');

var docs = {
    1: {a:1, b:2, id: 1}
  , 2: {a:3, b:4, id: 2}
  , 3: {a:5, b:6, id: 3}
};

function noop() {}

function cleanTransitions(stateDoc) {
  (stateDoc.transitions || []).forEach(function(transition) {
    if (transition.start) {transition.start = "SOME DATE";}
    if (transition.end) {transition.end = "SOME DATE";}
    delete transition.new_rev;
  });
}

exports.withStateStore = function(beforeExit) {
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
    assert.ok(! handlerCalled);
    handlerCalled = true;
    assert.eql({"a":5,"b":6,"id":3}, doc);
    assert.eql({}, this.meta);
    done(null, doc);
  };

  aHandler = function(doc, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    assert.eql({"a":5,"b":6,"id":3}, doc);
    assert.eql({}, this.meta);
    done(null, doc);
  };
  
  docStore = {
      load: function(id, done) {
        loadFunctionCalled = true;
        assert.eql(3, id);
        assert.eql({}, this.meta);
        process.nextTick(function() {
          done(null, docs[id]);
        });
      }
      
    , save: function(doc, done) {
        saveFunctionCalled = true;
        assert.eql({}, this.meta);
        assert.eql(3, doc.id);
        process.nextTick(function() {
          docs[doc.id] = doc;
          done(null, doc);
        });
      }
  };

  pipeline = new Pipeline('test pipeline 1', {
      queue: queue
  });
  pipeline
    .stateStore(stateStore())
    .docStore(docStore)
    .on('initial', initialHandler, {
      next: 'a'
    , condition: function(doc) {
        conditionCalled = true;
        return true;
      }
    })
    .on('a', aHandler, {
      next: 'b'
    })
    .on('b', function() {
      bHandlerCalled = true;
      pipeline.state(jobId, function(err, state) {
        assert.isNull(err);
        stateHandlerCalled = true;
        assert.equal('b', state);
      });
    })
    .push({a:5, b:6, id: 3}, function(err, id) {
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

exports.withoutStateStore = function(beforeExit) {
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
    , promiseFulfilled = false
    , jobId;

  initialHandler = function(doc, done) {
    assert.ok(! handlerCalled);
    assert.ok(! aHandlerCalled);
    handlerCalled = true;
    cleanTransitions(doc.state);
    assert.eql(doc, {"a":3,"b":4,"id":2,"state":{"pipeline":"test pipeline 2","state":"initial","doc_id":2,"running":true,"meta":{},"transitions":[{"from":"initial","start":"SOME DATE","old_rev":undefined}]}});
    assert.eql({}, this.meta);
    this.meta.i_am_here = 123;
    done(null, doc);
  };

  aHandler = function(doc, done) {
    assert.ok(! aHandlerCalled);
    aHandlerCalled = true;
    cleanTransitions(doc.state);
    assert.eql(doc, {"a":3,"b":4,"id":2,"state":{"pipeline":"test pipeline 2","state":"stateA","doc_id":2,"running":true,"meta":{"i_am_here":123},"transitions":[{"from":"initial","start":"SOME DATE","to":"stateA","end":"SOME DATE","old_rev":undefined},{"from":"stateA","start":"SOME DATE","old_rev":undefined}]}});
    assert.eql({i_am_here: 123}, this.meta);
    done(null, doc);
  };
  
  docStore = {
      load: function(id, done) {
        loadFunctionCalled = true;
        assert.eql(2, id);
        assert.isNotNull(this.meta);
        process.nextTick(function() {
          done(null, docs[id]);
        });
      }
  
    , save: function(doc, done) {
        saveFunctionCalled = true;
        assert.eql(2, doc.id);
        assert.isNotNull(this.meta);
        process.nextTick(function() {
          docs[doc.id] = doc;
          done(null, doc);
        });
      }
  };

  pipeline = new Pipeline('test pipeline 2');
  pipeline
    .queue(queue)
    .docStore(docStore)
    .on('initial', initialHandler, {
      next: 'stateA'
    , condition: function(doc) {
        assert.ok(! conditionCalled);
        conditionCalled = true;
        return true;
      }
    })
    .on('stateA', aHandler, {
      next: 'stateB'
    })
    .on('stateB', function(doc, done) {
      bHandlerCalled = true;
      assert.ok(jobId);
      pipeline.state(jobId, function(err, state) {
        assert.ok(! err, inspect(err && err.message) + inspect(err && err.stack));
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
      assert.ok(! promiseFulfilled);
      promiseFulfilled = true;
      cleanTransitions(doc.state);
      assert.eql(doc, {"a":3,"b":4,"id":2,"state":{"pipeline":"test pipeline 2","state":"stateB","doc_id":2,"running":false,"meta":{"i_am_here":123},"transitions":[{"from":"initial","start":"SOME DATE","to":"stateA","end":"SOME DATE","old_rev":undefined},{"from":"stateA","start":"SOME DATE","to":"stateB","end":"SOME DATE","old_rev":undefined},{"from":"stateB","start":"SOME DATE","old_rev":undefined}]}});
    })
    .error(function(err) {
      throw err;
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

exports.back = function(beforeExit) {
  var docStore = stateStore()
    , _stateStore = stateStore()
    , pipeline
    , undoCalledBack = false
    , calledback = false
    , jobId;

  
  function initialHandler(doc, done) {
    doc.c = 1;
    done(null, doc);
  }

  function aHandler(doc, done) {
    doc.c = 2;
    done(null, doc);
  }
  
  docStore.save({a:1, b:2}, function(err, doc) {
    if (err) { throw err; }
    
    pipeline = new Pipeline('test pipeline 3');
    pipeline
      .queue(queue)
      .stateStore(_stateStore)
      .docStore(docStore)
      .on('initial', initialHandler, {
        next: 'a'
      })
      .on('a', aHandler, {
          undo: function(doc, done) {
            undoCalledBack = true;
            done();
          }
      })
      .push(doc, function(err, id) {
        jobId = id;
        assert.isNull(err);
        assert.equal('number', typeof(id));
      })
      .then(function() {
        setTimeout(function() {
          pipeline.back(jobId, 'a', 'initial', function(err) {
            if (err) { throw err; }
            setTimeout(function() {
              docStore.load(doc.id || doc._id, function(err, doc) {
                calledback = true;
                if (err) { throw err; }
                assert.ok(doc, 'doc does not exist');
                assert.eql(1, doc.c);
              });
            }, 1000);
          });
        }, 1000);
      });
  });
  

  beforeExit(function() {
    assert.ok(calledback);
    assert.ok(undoCalledBack);
  });    
};

exports.play = function(beforeExit) {
  var docStore = stateStore()
    , _stateStore = stateStore()
    , calledback = false
    , pipeline
    , jobId;

  
  function initialHandler(doc, done) {
    doc.c = 1;
    done(null, doc);
  }

  function aHandler(doc, done) {
    doc.c = 2;
    done(null, doc);
  }
  
  docStore.save({a:1, b:2}, function(err, doc) {
    if (err) { throw err; }

    pipeline = new Pipeline('test pipeline 4');
    pipeline
      .queue(queue)
      .stateStore(_stateStore)
      .docStore(docStore)
      .on('initial', initialHandler, {
        next: 'a'
      })
      .on('a', aHandler)
      .push(doc, function(err, id) {
        jobId = id;
        assert.isNull(err);
      })
      .then(function() {
        setTimeout(function() {
          pipeline.back(jobId, 'a', 'initial', function(err) {
            assert.ok(! err);
            setTimeout(function() {
              docStore.load(doc.id, function(err, doc) {
                assert.isNull(err);
                assert.eql(1, doc.c);
                pipeline.play(jobId, function(err) {
                  assert.isUndefined(err);
                  setTimeout(function() {
                    docStore.load(doc.id, function(err, doc) {
                      calledback = true;
                      assert.isNull(err);
                      assert.eql(2, doc.c);
                    });
                  }, 1000);
              });
              });
            }, 1000);
          });
        }, 1000);
      });
  });
};