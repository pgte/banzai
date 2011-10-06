var State        = require('./state')
  , Promise      = require('./promise')
  , inspect      = require('util').inspect;

DEFAULT_PRIORITY = 0;

var noop = function() {};

function Pipeline(name, options) {
  if (! options) { options = {}; }
  var initialState = options.initialState || 'initial'
    , errorState = options.errorState || 'error'
    , queue = options.queue
    , stateStore = options.stateStore
    , docStore = options.docStore
    
    , states = {}

    , info = options.info || noop
    , error = options.error || console.log
    , verbose = options.verbose || noop
  
    , embedStateInDocProp = options.embedStateInDocProp || 'state'
    
    , promise
    , that
    , friend;


  /***** Private ******/

  function jobName(state) {
    return 'banzai-' + name + '-' + state;
  }

  function createJob(stateDoc, doc, done) {
    if (! stateDoc.state) { return done(new Error('Undefined state on state doc: ' + JSON.stringify(stateDoc))); }
    verbose('Creating job for state ' + JSON.stringify(stateDoc.state));
    if (! queue) { return done('You must configure this pipeline with a queue'); }
    queue.push(jobName(stateDoc.state), stateDoc, done);
  }
  
  function saveDoc(doc, context, done) {
    if (! docStore || ! docStore.save) { return done(new Error('You must provide a doc store with a save function for this pipeline.')); }
    docStore.save.call(context, doc, done, verbose);
  }
  
  function saveState(doc, stateDoc, done) {
    var context;
    
    if (stateStore) {
      context = {
        log: verbose
      };
      stateStore.save.call(context, stateDoc, done, verbose);
    } else {
      doc[embedStateInDocProp] = stateDoc;
      context = {
        meta: stateDoc.meta
      }
      saveDoc(doc, context, function(err) {
        if (err) { return done(err); }
        done(null, stateDoc);
      });
    }
  }
  
  function loadDoc(docId, context, done) {
    if (! docStore || ! docStore.load) { return done(new Error('You must provide a doc store with a load function for this pipeline.')); }
    docStore.load.call(context, docId, done, verbose);
  }
  
  function loadState(id, context, done) {
    if (stateStore) {
      stateStoreContext = {
        log: verbose
      };
      stateStore.load.call(stateStoreContext, id, function(err, stateDoc) {
        if (err) {return done(err);}
        done(null, stateDoc);
      });
    } else {
      try {
        context = {
          meta: {}
        };
        loadDoc(id, context, function(err, doc) {
          if (err) {return done(err);}
          done(null, doc && doc[embedStateInDocProp]);
        });
      } catch (err) {
        done(err);
      }
    }
    
  };
  
  /***** Semi-Private ******/

  function handleStateEntry(doc, stateDoc, stateName, done) {
    var state = states[stateName];

    if (! stateDoc.transitions) { stateDoc.transitions = [] };
    stateDoc.transitions.push({
        from: stateDoc.state
      , start: new(Date)
    });

    if (state){
      state.handle(doc, stateDoc, function(err, changedState) {
        if (err) { return toErrorState(doc, stateDoc, err)}
        if (! changedState) {
          // We're finished, no more states
          if (promise) { promise.fulfill(doc); }
        }
        done(null);
      }, verbose);
    } else {
      // no such state, we're finished
      if (promise) { promise.fulfill(doc); }
      done(null);
    }
  };

  function toState(doc, stateDoc, state, done) {
    var transitions
      , transition
      , context;

    info(JSON.stringify({
        action: 'entering state ' + state
      , doc_id: stateDoc.doc_id, }));

    stateDoc.state = state;

    if (! stateDoc.meta) { stateDoc.meta = {}; }

    if (! stateDoc.transitions) { stateDoc.transitions = []};
    transitions = stateDoc.transitions;
    if (transitions.length > 0) {
      transition = transitions[transitions.length - 1];
    } else {
      transition = {}
      transitions.push(transition);
    }
    transition.to = state;
    transition.end = new(Date);

    if (! stateStore) {
      doc[embedStateInDocProp] = stateDoc;
    }
    try {
      
      context = {
        meta: stateDoc.meta
      };
      
      saveDoc(doc, context, function(err, doc) {
        var context;
        
        if (! doc) { return done(new Error('No doc after save')); }
        
        if (err) {  done(err); return toErrorState(doc, stateDoc, err, true); }
        
        transition.new_rev = doc._rev;
        
        saveState(doc, stateDoc, function(err, newStateDoc) {
          if (err) { done(err); toErrorState(doc, stateDoc, err, true); }
          createJob(newStateDoc, doc, function(err) {
            if (err) { done(err); return toErrorState(doc, newStateDoc, err, true); }
            done(null);
          });
        });
      });

    } catch (err) {
      toErrorState(doc, stateDoc, err, true);
    }
  };

  function toErrorState(doc, stateDoc, err, fromError) {
    error('Error:' + inspect(err && err.message) + ' at ' + inspect(err && err.stack) + '. Current stack: ' + inspect(new Error().stack) + '. Full error: ' + inspect(err));
    if (! stateDoc.errors) {stateDoc.errors = [];}
    stateDoc.errors.push(err);
    if (promise) { promise.setError(err); }
    if (! fromError) { toState(doc, stateDoc, errorState, noop); }
  };
  
  friend = {
      handleStateEntry: handleStateEntry
    , toState: toState
    , toErrorState: toErrorState
  };
  
  

  /***** Public ******/
  function push(doc, meta, done) {
    var id = doc.id || doc._id
      , state = initialState
      , stateDoc = { pipeline: name, state: state, doc_id: id }
      , context
      , stateStoreContext;

    promise = new Promise();

    if ((typeof(meta) === 'function') && ! done) {
      done = meta;
      meta = {};
    }
    if (! meta) { meta = {}; }
    stateDoc.meta = meta;

    if ((! done) || typeof(done) !== 'function') { return done(new Error('pipeline push with invalid callback: ' + done))}
    if (! id) { return done(new Error('Document has no .id or ._id field in it: ' + JSON.stringify(doc))); }

    saveState(doc, stateDoc, function(err, stateDoc) {
      if (err) { return done(err); }
      verbose('pushing doc: ' + JSON.stringify(doc));
      createJob(stateDoc, doc, function(err) {
        if (err) {return done(err);}
        done(null, stateDoc.id || stateDoc._id || doc.id || doc.__id);
      });
    });

    return promise;
  };

  /*** Chainable configuration ***/

  function _queue(q) {
    queue = q;
    return that;
  };

  function _stateStore(ss) {
    stateStore = ss;
    return that;
  };

  function _docStore(ds) {
    docStore = ds;
    return that;
  };

  function _initialState(state) {
    initialState = state;
    return that;
  };

  function _errorState(state) {
    errorState = state;
    return that;
  };

  function on(stateName, handler, options) {
    var successState, errorState, priority, condition, state;

    if (! options) {options = {};}
    if (! stateName) {throw(new Error("invalid state name"));}
    if (typeof(handler) !== "function") {throw(new Error("invalid handler, should be a function"));}
    if (typeof(options) !== "object") {throw(new Error("invalid options"));}

    successState = options.next;
    priority = options.priority || DEFAULT_PRIORITY;
    condition = options.condition;
    state = states[stateName] || State(stateName, friend);
    states[stateName] = state;
    state.addTransition(handler, successState, priority, condition);

    if (! queue) { return done('You must configure this pipeline with a queue'); }
    queue.pop(jobName(stateName), function(job, done) {
      var stateDoc = job
        , context;
      if (! stateDoc.hasOwnProperty('meta')) { stateDoc.meta = {}; }
      try {
        context = {
          meta: stateDoc.meta
        };
        loadDoc(stateDoc.doc_id, context, function(err, doc) {
          if (err) { return done(err); }
          handleStateEntry(doc, stateDoc, stateName, done);
        });
      } catch (err) {
        toErrorState({_id: stateDoc.doc_id, error: "Could not load doc"}, stateDoc, err);
      }
    });
    return that;
  };

  function stateFor(id, done) {
    var stateStoreContext = {
      log: verbose
    };

    loadState(id, stateStoreContext, function(err, stateDoc) {
      if (err) {return done(err);}
      done(null, stateDoc.state);
    });

  };

  that = {
      push: push
    , queue: _queue
    , stateStore: _stateStore
    , docStore: _docStore
    , initialState: _initialState
    , errorState: _errorState
    , on: on
    , stateFor: stateFor
    , state: stateFor
  };
  
  friend.__proto__ = that;
  
  return that;

};

module.exports = Pipeline;