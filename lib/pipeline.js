var State        = require('./state')
  , DB           = require('./db');

DEFAULT_PRIORITY = 0;

var Pipeline = function(name, options) {
  if (! options) options = {};
  this.name = name;
  this.initialState = options.initialState || 'initial';
  this.errorState = options.errorState || 'error';
  this.loadFunction = options.loadFunction;
  if ((! this.loadFunction) || typeof(this.loadFunction) != 'function') throw new Error('Please provide an options.loadFunction function');
  this.states = {};
};

/***** Private ******/

Pipeline.prototype._handleStateEntry = function(doc, stateDoc, stateName) {
  var state = this.states[stateName];
  if (state) state.handle(doc, stateDoc);
};

Pipeline.prototype._bindStateEntry = function() {
  var self = this;
  this.db.on('change', function(stateDoc) {
    self._load(stateDoc.doc_id, function(err, doc) {
      if (err) return self._toErrorState(doc, stateDoc, err);
      self._handleStateEntry(doc, stateDoc, stateDoc.state);
    });
  });
};

Pipeline.prototype._toState = function(doc, stateDoc, state) {
  var self = this;
  stateDoc.state = state;
  this.db.update(stateDoc.id, stateDoc, function(err, newStateDoc) {
    if (err) self._toErrorState(doc, stateDoc, err, true)
  });
};

Pipeline.prototype._toErrorState = function(doc, stateDoc, error, fromError) {
  if (! stateDoc.errors) stateDoc.errors = [];
  stateDoc.errors.push(error);
  if (! fromError) this.pipeline._toState(doc, stateDoc, this.errorState);
};

Pipeline.prototype._load = function(id, done) {
  this.loadFunction(id, done);
};


/***** Public ******/
Pipeline.prototype.push = function(doc, done) {
  var self = this
    , state = self.initialState
    , id = doc.id || doc._id;

  if (! this.db) return done(new Error('No database in use. Use pipeline.use(type, uri) to define a database.'))

  this.db.create({ state: state, doc_id: id }, function(err, stateDoc) {
    if (err) return done(err);
    done(null, stateDoc.id);
  });

  return this;
};

Pipeline.prototype.on = function(stateName, handler, options) {
  var successState, errorState, priority, condition, state;
  
  if (! stateName) throw(new Error("invalid state name"));
  if (typeof(handler) != "function") throw(new Error("invalid handler, should be a function"));
  if (typeof(options) != "object") throw(new Error("invalid options"));
  
  successState = options.success
  if (! successState) throw(new Error('options.success is required'))
  priority = options.priority || DEFAULT_PRIORITY;
  condition = options.condition;
  state = this.states[stateName] || new State(stateName, this);
  this.states[stateName] =  state;
  state.addTransition(handler, successState, priority, condition);
  return this;
};

Pipeline.prototype.use = function(type, uri) {
  this.db = DB.findByType(type);
  if (! this.db) throw(new Error('Unsupported DB type: ' + type));
  this.db.setUri(uri);
  this._bindStateEntry();
  return this;
};

module.exports = Pipeline;