var State        = require('./state')
  , DB           = require('./db')
  , Promise      = require('./promise');

DEFAULT_PRIORITY = 0;

var noop = function() {};

var Pipeline = function(name, options) {
  if (! options) { options = {}; }
  this.name = name;
  this.initialState = options.initialState || 'initial';
  this.errorState = options.errorState || 'error';
  this.loadFunction = options.load;
  this.queue = options.queue;
  if (! this.queue) { throw new Error('Please provide an options.queue object'); }
  if ((! this.loadFunction) || typeof(this.loadFunction) !== 'function') {throw new Error('Please provide an options.load function');}
  this.saveFunction = options.save;
  if ((! this.saveFunction) || typeof(this.saveFunction) !== 'function') {throw new Error('Please provide an options.save function');}
  this.states = {};

  this.info = options.info || noop;
  this.error = options.error || noop;
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
  this.queue.push(this._jobName(stateDoc.state), stateDoc, done);
};


Pipeline.prototype._handleStateEntry = function(doc, stateDoc, stateName, done) {
  var self = this
    , state = this.states[stateName];
    
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
  var self = this;
  this.info(JSON.stringify({action: 'entering state ' + state, doc_id: stateDoc.doc_id, }));
  stateDoc.state = state;
  if (! this.db) {
    doc[this.embedStateInDocProp] = stateDoc;
  }
  try {
    this.saveFunction(doc, stateDoc.meta, function(err) {
      var stateDocId;

      function createJob(stateDoc) {
        self._createJob(stateDoc, doc, function(err) {
          if (err) { done(err); return self._toErrorState(doc, stateDoc, err, true); }
          done(null);
        });
      }

      if (err) {  done(err); return self._toErrorState(doc, stateDoc, err, true); }
      if (self.db) {
        stateDocId = stateDoc.id || stateDoc._id;
        if (stateDocId) {
          self.db.update(stateDocId, stateDoc, function(err, newStateDoc) {
            if (err) { done(err); return self._toErrorState(doc, stateDoc, err, true); }
            createJob(newStateDoc);
          }, self.verbose);
        } else {
          self.db.create(stateDoc, function(err, newStateDoc) {
            if (err) { done(err); return self._toErrorState(doc, stateDoc, err, true); }
            createJob(newStateDoc);
          }, self.verbose);
        }
      } else {
        createJob(stateDoc);
      }
    }, this.verbose);
  } catch (err) {
    self._toErrorState(doc, stateDoc, err, true);
  }
};

Pipeline.prototype._toErrorState = function(doc, stateDoc, error, fromError) {
  this.error('Error:' + JSON.stringify(error));
  if (! stateDoc.errors) {stateDoc.errors = [];}
  stateDoc.errors.push(error);
  if (this.promise) { this.promise.setError(error); }
  if (! fromError) {this._toState(doc, stateDoc, this.errorState, noop);}
};

/***** Public ******/
Pipeline.prototype.push = function(doc, meta, done) {
  var self = this
    , id = doc.id || doc._id
    , state = self.initialState
    , stateDoc = { pipeline: this.name, state: state, doc_id: id }
  
  this.promise = new Promise();
  
  if ((typeof(meta) === 'function') && ! done) {
    done = meta;
    meta = {};
  }
  stateDoc.meta = meta;
  
  if ((! done) || typeof(done) !== 'function') { return done(new Error('pipeline push with invalid callback: ' + done))}
  if (! id) { return done(new Error('Document has no .id or ._id field in it: ' + JSON.stringify(doc))); }

  function createJobAndCallback(id) {
    self.verbose('pushing doc: ' + JSON.stringify(doc));
    var job = self._createJob(stateDoc, doc, function(err) {
      if (err) {return done(err);}
      done(null, id);
    });
  }

  if (this.db) {
    this.db.create(stateDoc, function(err, stateDoc) {
      if (err) {return done(err);}
      createJobAndCallback(stateDoc.id || stateDoc._id);
    }, self.verbose);
  } else {
    doc[this.embedStateInDocProp] = stateDoc;
    this.saveFunction(doc, stateDoc, function(err) {
      if (err) { return done(err); }
      createJobAndCallback(id);
    });
  }
  
  return this.promise;
};

Pipeline.prototype.on = function(stateName, handler, options) {
  var self = this
    , successState, errorState, priority, condition, state;
  
  if (! options) {options = {};}
  if (! stateName) {throw(new Error("invalid state name"));}
  if (typeof(handler) !== "function") {throw(new Error("invalid handler, should be a function"));}
  if (typeof(options) !== "object") {throw(new Error("invalid options"));}
  
  successState = options.success;
  priority = options.priority || DEFAULT_PRIORITY;
  condition = options.condition;
  state = this.states[stateName] || new State(stateName, this);
  this.states[stateName] = state;
  state.addTransition(handler, successState, priority, condition);
  
  this.queue.pop(this._jobName(stateName), function(job, done) {
    var stateDoc = job;
    if (! stateDoc.hasOwnProperty('meta')) { stateDoc.meta = {}; }
    try {
      self.loadFunction(stateDoc.doc_id, stateDoc.meta, function(err, doc) {
        if (err) {return done(err);} // FIXME: should we throw the error here? I think so...
        self._handleStateEntry(doc, stateDoc, stateName, done);
      }, self.verbose);
    } catch (err) {
      self._toErrorState({_id: stateDoc.doc_id, error: "Could not load doc"}, stateDoc, err);
    }
  });
  return this;
};

Pipeline.prototype.useForMeta = function(type, uri) {
  this.db = DB.findByType(type);
  if (! this.db) {throw(new Error('Unsupported DB type: ' + type));}
  this.db.setUri(uri);
  return this;
};

Pipeline.prototype.use = Pipeline.prototype.useForMeta;

Pipeline.prototype.stateFor = function(id, done) {
  var self = this;
  if (this.db) {
    this.db.get(id, function(err, stateDoc) {
      if (err) {return done(err);}
      done(null, stateDoc.state);
    }, this.verbose);
  } else {
    try {
      this.loadFunction(id, {}, function(err, doc) {
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