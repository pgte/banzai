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
  
  function jobBackName(fromState, toState) {
    return 'banzai-' + name + '-__BACK__-' + fromState + '-' + toState;
  }

  function createJob(stateDoc, done) {
    if (! stateDoc.state) { return done(new Error('Undefined state on state doc: ' + JSON.stringify(stateDoc))); }
    verbose('Creating job for state ' + JSON.stringify(stateDoc.state));
    if (! queue) { return done('You must configure this pipeline with a queue'); }
    queue.push(jobName(stateDoc.state), stateDoc, done);
  }
  
  function saveDoc(doc, context, done) {
    if (! docStore || ! docStore.save) { return done(new Error('You must provide a doc store with a save function for this pipeline.')); }
    docStore.save.call(context, doc, done, verbose);
  }
  
  function saveState(stateDoc, done) {
    var context,
      docContext;
    
    if (stateStore) {
      context = {
        log: verbose
      };
      stateStore.save.call(context, stateDoc, done, verbose);
    } else {
      docContext = { meta: stateDoc.meta };
      loadDoc(stateDoc.doc_id, docContext, function(err, doc) {
        if (err) { return done(err); }
        doc[embedStateInDocProp] = stateDoc;
        context = {
          meta: stateDoc.meta
        };
        saveDoc(doc, context, function(err) {
          if (err) { return done(err); }
          done(null, stateDoc);
        });
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
  }
  
  /***** Semi-Private ******/

  function handleStateEntry(doc, stateDoc, stateName, done) {
    var state = states[stateName];
    
    if (! stateDoc.transitions) { stateDoc.transitions = []; }
    stateDoc.transitions.push({
        from: stateDoc.state
      , start: new Date()
      , old_rev: doc._rev
    });
    
    function noMoreStates() {
      stateDoc.running = false;
      saveState(stateDoc, function(err) {
        if (err) { return done(err); }
        if (promise) { promise.fulfill(doc); }
          done(null);
      });
    }

    if (state){
      state.handle(doc, stateDoc, function(err, changedState) {
        if (err) { return toErrorState(doc, stateDoc, err); }
        if (! changedState) {
          noMoreStates();
        }
      }, verbose);
    } else {
      // no such state, we're finished
      noMoreStates();
    }
  }

  function toState(doc, stateDoc, state, done) {
    var transitions
      , transition
      , context;

    info(JSON.stringify({
        action: 'entering state ' + state
      , doc_id: stateDoc.doc_id, }));

    stateDoc.state = state;

    if (! stateDoc.meta) { stateDoc.meta = {}; }

    if (! stateDoc.transitions) { stateDoc.transitions = []; }
    transitions = stateDoc.transitions;
    if (transitions.length > 0) {
      transition = transitions[transitions.length - 1];
    } else {
      transition = {};
      transitions.push(transition);
    }
    transition.to = state;
    transition.end = new Date();

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
        
        // sets the new revision on the transition
        transition.new_rev = doc._rev;
        
        saveState(stateDoc, function(err, newStateDoc) {
          if (err) { done(err); toErrorState(doc, stateDoc, err, true); }
          createJob(newStateDoc, function(err) {
            if (err) { done(err); return toErrorState(doc, newStateDoc, err, true); }
            done(null);
          });
        });
      });

    } catch (err) {
      toErrorState(doc, stateDoc, err, true);
    }
  }

  function toErrorState(doc, stateDoc, err, fromError) {
    error('Error:' + inspect(err && err.message) + ' at ' + inspect(err && err.stack) + '. Current stack: ' + inspect(new Error().stack) + '. Full error: ' + inspect(err));
    if (! stateDoc.errors) { stateDoc.errors = []; }
    stateDoc.errors.push(err);
    if (promise) { promise.setError(err); }
    if (! fromError) { toState(doc, stateDoc, errorState, noop); }
  }
  
  friend = {
      handleStateEntry: handleStateEntry
    , toState: toState
    , toErrorState: toErrorState
  };
  
  

  /***** Public ******/
  function push(doc, meta, done) {
    var id = doc.id || doc._id
      , state = initialState
      , stateDoc = { pipeline: name
                   , state: state
                   , doc_id: id
                   , running: true  }
      , context
      , stateStoreContext;

    promise = new Promise();

    if ((typeof(meta) === 'function') && ! done) {
      done = meta;
      meta = {};
    }
    if (! meta) { meta = {}; }
    stateDoc.meta = meta;

    if ((! done) || typeof(done) !== 'function') { return done(new Error('pipeline push with invalid callback: ' + done)); }
    if (! id) { return done(new Error('Document has no .id or ._id field in it: ' + JSON.stringify(doc))); }

    saveState(stateDoc, function(err, stateDoc) {
      if (err) { return done(err); }
      verbose('pushing doc: ' + JSON.stringify(doc));
      createJob(stateDoc, function(err) {
        if (err) {return done(err);}
        done(null, stateDoc.id || stateDoc._id || doc.id || doc.__id);
      });
    });

    return promise;
  }

  /*** Chainable configuration ***/
  
  function _verbose(logger) {
    verbose = logger;
    return that;
  }

  function _queue(q) {
    queue = q;
    return that;
  }

  function _stateStore(ss) {
    stateStore = ss;
    return that;
  }

  function _docStore(ds) {
    docStore = ds;
    return that;
  }

  function _initialState(state) {
    initialState = state;
    return that;
  }

  function _errorState(state) {
    errorState = state;
    return that;
  }
  
  function workerForward(stateDoc, stateName, done) {
    var context;

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
  }
  
  function workerBack(stateDoc, from, to, done) {
    var transitions
      , state;

    transitions = stateDoc.transitions;
    if (! transitions) { return done(new Error('No transitions for state with ID ' + id)); }

    function allTheWayBack(done) {
      var lastTransition;

      (function backOne() {
        var state
          , transition = transitions.splice(transitions.length - 1, 1)[0];

        lastTransition = transition;

        if (! transition) { return done(); }
        if (transition.to === to) { return done(); }

        state = states[transition.to || transition.from];
        if (! state) { return done(new Error('State not found: ' + (transition.to || transition.from))); }
        verbose('[' + stateDoc.doc_id + '] reverting transition ' + JSON.stringify(transition));
        
        docStore.load(stateDoc.doc_id, function(err, doc) {
          if (err) { return done(err); }
          state.undoTo(doc, transition.from, function(err) {
            if (err) { return done(err); }
            docStore.backToRevision(stateDoc.doc_id, transition.old_rev, function(err) {
              if (err) { verbose(err); return done(err); }
              stateDoc.state = transition.from;
              backOne();
            });
          });
        });
      }());
    }
    
    allTheWayBack(function(err) {
      if (err) { verbose(err); return done(err); }
      stateDoc.running = false;
      stateStore.save(stateDoc, done);
    });
  }

  function on(stateName, handler, options) {
    var successState, errorState, priority, condition, state;

    if (! options) {options = {};}
    if (! stateName) {throw(new Error("invalid state name"));}
    if (typeof(handler) !== "function") { throw(new Error("invalid handler, should be a function")); }
    if (typeof(options) !== "object") { throw(new Error("invalid options")); }

    successState = options.next;
    priority = options.priority || DEFAULT_PRIORITY;
    condition = options.condition;
    state = states[stateName] || State(stateName, friend);
    states[stateName] = state;
    state.addTransition(handler, successState, priority, condition, options.undo);

    // Forward
    if (! queue) { throw new Error('You must configure this pipeline with a queue'); }
    queue.pop(jobName(stateName), function(job, done) {
      workerForward(job, stateName, done);
    });
    
    // Back
    queue.pop(jobBackName(successState, stateName), function(job, done) {
      workerBack(job.stateDoc, job.from, job.to, done);
    });
    
    return that;
  }

  function stateFor(id, done) {
    var stateStoreContext = {
      log: verbose
    };

    loadState(id, { log: verbose }, function(err, stateDoc) {
      if (err) {return done(err);}
      done(null, stateDoc.state);
    });
  }
  
  function back(id, from, to, done) {
    verbose('[#' + id + '] backing from state ' + from + ' to ' + to);
    if (! queue) { return done('You must configure this pipeline with a queue'); }
    loadState(id, { log: verbose }, function(err, stateDoc) {
      if (err) { return done(err); }
      if (stateDoc.running) { return done(new Error('document is still running')); }
      stateDoc.running = true;
      if (from !== stateDoc.state) { return done(new Error('document is not on state ' + from)); }
      saveState(stateDoc, function(err) {
        if (err) { return done(err); }
        queue.push(jobBackName(from, to), {
            stateDoc: stateDoc
          , from: from
          , to: to
        }, done);
      });
    });
  }
  
  function play(id, done) {
    verbose('[#' + id + '] play');
    if (! queue) { return done('You must configure this pipeline with a queue'); }
    loadState(id, { log: verbose }, function(err, stateDoc) {
      if (err) { return done(err); }
      if (stateDoc.running) { return done(new Error('document is still running')); }
      stateDoc.running = true;
      saveState(stateDoc, function(err) {
        if (err) { return done(err); }
        createJob(stateDoc, done);
      });
    });
  }

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
    , verbose: _verbose
    , back: back
    , play: play
  };
  
  friend.__proto__ = that;
  
  return that;

}

module.exports = Pipeline;