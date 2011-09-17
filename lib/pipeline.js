var State        = require('./state')
  , Promise      = require('./promise')
  , inspect      = require('util').inspect;

DEFAULT_PRIORITY = 0;

var noop = function() {};

var Pipeline = function(name, options) {
  if (! options) { options = {}; }
  this.name = name;
  this._initialState = options.initialState || 'initial';
  this._errorState = options.errorState || 'error';

  this._queue = options.queue;
  this._stateStore = options.stateStore;
  this._docStore = options.docStore;

  this.states = {};

  this.info = options.info || noop;
  this.error = options.error || console.log;
  this.verbose = options.verbose || noop;
  
  this.embedStateInDocProp = options.embedStateInDocProp || 'state';
};

/***** Private ******/

Pipeline.prototype._jobName = function(state) {
  return 'banzai-' + this.name + '-' + state;
};

Pipeline.prototype._createJob = function(stateDoc, doc, done) {
  var self = this;
  if (! stateDoc.state) { return done(new Error('Undefined state on state doc: ' + JSON.stringify(stateDoc))); }
  this.verbose('Creating job for state ' + JSON.stringify(stateDoc.state));
  if (! this._queue) { return done('You must configure this pipeline with a queue'); }
  this._queue.push(this._jobName(stateDoc.state), stateDoc, done);
};


Pipeline.prototype._handleStateEntry = function(doc, stateDoc, stateName, done) {
  var self = this
    , state = this.states[stateName];
  
  if (! stateDoc.transitions) { stateDoc.transitions = []};
  stateDoc.transitions.push({
      from: stateDoc.state
    , start: (new Date).toUTCString()
  });
    
  if (state){
    state.handle(doc, stateDoc, function(err, changedState) {
      if (err) { return self._toErrorState(doc, stateDoc, err)}
      if (! changedState) {
        // We're finished, no more states
        if (self.promise) { self.promise.fulfill(doc); }
      }
      done(null);
    }, self.verbose);
  } else {
    // no such state, we're finished
    if (this.promise) { this.promise.fulfill(doc); }
    done(null);
  }
};

Pipeline.prototype._toState = function(doc, stateDoc, state, done) {
  var self = this
    , transitions
    , transition
    , context;

  this.info(JSON.stringify({action: 'entering state ' + state, doc_id: stateDoc.doc_id, }));
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
  transition.end = (new Date).toUTCString();
  
  if (! this._stateStore) {
    doc[this.embedStateInDocProp] = stateDoc;
  }
  try {
    context = {
      meta: stateDoc.meta
    };
    if (! self._docStore || ! self._docStore.save) { return done(new Error('You must provide a doc store with a save function for this pipeline.')); }
    this._docStore.save.call(context, doc, function(err) {
      var context;

      function createJob(stateDoc) {
        self._createJob(stateDoc, doc, function(err) {
          if (err) { done(err); return self._toErrorState(doc, stateDoc, err, true); }
          done(null);
        });
      }

      if (err) {  done(err); return self._toErrorState(doc, stateDoc, err, true); }
      if (self._stateStore) {
        context = {
            log: self.verbose
        };
        self._stateStore.save.call(context, stateDoc, function(err, newStateDoc) {
          if (err) { done(err); return self._toErrorState(doc, stateDoc, err, true); }
          createJob(newStateDoc);
        });
      } else {
        createJob(stateDoc);
      }
    }, this.verbose);

  } catch (err) {
    self._toErrorState(doc, stateDoc, err, true);
  }
};

Pipeline.prototype._toErrorState = function(doc, stateDoc, error, fromError) {
  this.error('Error:' + inspect(error.message) + ' at ' + inspect(error.stack));
  if (! stateDoc.errors) {stateDoc.errors = [];}
  stateDoc.errors.push(error);
  if (this.promise) { this.promise.setError(error); }
  if (! fromError) {this._toState(doc, stateDoc, this._errorState, noop);}
};

/***** Public ******/
Pipeline.prototype.push = function(doc, meta, done) {
  var self = this
    , id = doc.id || doc._id
    , state = this._initialState
    , stateDoc = { pipeline: this.name, state: state, doc_id: id }
    , context
    , stateStoreContext;
  
  this.promise = new Promise();
  
  if ((typeof(meta) === 'function') && ! done) {
    done = meta;
    meta = {};
  }
  if (! meta) { meta = {}; }
  stateDoc.meta = meta;
  
  if ((! done) || typeof(done) !== 'function') { return done(new Error('pipeline push with invalid callback: ' + done))}
  if (! id) { return done(new Error('Document has no .id or ._id field in it: ' + JSON.stringify(doc))); }

  function createJobAndCallback(id, stateDoc) {
    self.verbose('pushing doc: ' + JSON.stringify(doc));
    var job = self._createJob(stateDoc, doc, function(err) {
      if (err) {return done(err);}
      done(null, id);
    });
  }

  if (this._stateStore) {
    stateStoreContext = {
      log: self.verbose
    };
    this._stateStore.save.call(stateStoreContext, stateDoc, function(err, stateDoc) {
      if (err) {return done(err);}
      createJobAndCallback(stateDoc.id || stateDoc._id, stateDoc);
    });
  } else {
    doc[this.embedStateInDocProp] = stateDoc;
    context = {
      meta: meta
    }
    if (! self._docStore || ! self._docStore.save) { return done(new Error('You must provide a doc store with a save function for this pipeline.')); }
    this._docStore.save.call(context, doc, function(err) {
      if (err) { return done(err); }
      createJobAndCallback(id, stateDoc);
    });
  }
  
  return this.promise;
};

/*** Chainable configuration ***/

Pipeline.prototype.queue = function(queue) {
  this._queue = queue;
  return this;
};

Pipeline.prototype.stateStore = function(stateStore) {
  this._stateStore = stateStore;
  return this;
};

Pipeline.prototype.docStore = function(docStore) {
  this._docStore = docStore;
  return this;
};

Pipeline.prototype.initialState = function(initialState) {
  this._initialState = initialState;
  return this;
};

Pipeline.prototype.errorState = function(errorState) {
  this._errorState = errorState;
  return this;
};


Pipeline.prototype.on = function(stateName, handler, options) {
  var self = this
    , successState, errorState, priority, condition, state;
  
  if (! options) {options = {};}
  if (! stateName) {throw(new Error("invalid state name"));}
  if (typeof(handler) !== "function") {throw(new Error("invalid handler, should be a function"));}
  if (typeof(options) !== "object") {throw(new Error("invalid options"));}
  
  successState = options.next;
  priority = options.priority || DEFAULT_PRIORITY;
  condition = options.condition;
  state = this.states[stateName] || new State(stateName, this);
  this.states[stateName] = state;
  state.addTransition(handler, successState, priority, condition);
  
  if (! this._queue) { return done('You must configure this pipeline with a queue'); }
  this._queue.pop(this._jobName(stateName), function(job, done) {
    var stateDoc = job
      , context;
    if (! stateDoc.hasOwnProperty('meta')) { stateDoc.meta = {}; }
    try {
      context = {
        meta: stateDoc.meta
      };
      if (! self._docStore || ! self._docStore.load) { return done(new Error('You must provide a doc store with a load function for this pipeline.')); }
      self._docStore.load.call(context, stateDoc.doc_id, function(err, doc) {
        if (err) {return done(err);} // FIXME: should we throw the error here? I think so...
        self._handleStateEntry(doc, stateDoc, stateName, done);
      }, self.verbose);
    } catch (err) {
      self._toErrorState({_id: stateDoc.doc_id, error: "Could not load doc"}, stateDoc, err);
    }
  });
  return this;
};

Pipeline.prototype.stateFor = function(id, done) {
  var self = this
    , context
    , stateStoreContext;
    
  if (this._stateStore) {
    stateStoreContext = {
      log: this.verbose
    };
    this._stateStore.load.call(stateStoreContext, id, function(err, stateDoc) {
      if (err) {return done(err);}
      done(null, stateDoc.state);
    });
  } else {
    try {
      context = {
        meta: {}
      };
      if (! this._docStore || ! this._docStore.load) { return done(new Error('You must provide a doc store with a load function for this pipeline.')); }
      this._docStore.load.call(context, id, function(err, doc) {
        var stateDoc = doc && doc[self.embedStateInDocProp]
          , state    = stateDoc ? stateDoc.state : undefined;

        if (err) {return done(err);}
        done(null, state);
      }, this.verbose);
    } catch (err) {
      done(err);
    }
  }
};

Pipeline.prototype.state = Pipeline.prototype.stateFor;

module.exports = Pipeline;