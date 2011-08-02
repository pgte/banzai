var EventEmitter = require('events').EventEmitter
  , State        = require('./state')
  , DB           = require('./db');

DEFAULT_PRIORITY = 0;

var Pipeline = function(name, options) {
  this.name = name;
  this.emitter = new EventEmitter();
  this.initialState = options.initialState || 'initial';
  this.states = {};
};

/***** Private ******/

Pipeline.prototype._handleStateEntry = function(doc, stateDoc, stateName) {
  var state = this.states[stateName];
  if (! state) throw new Error('Unknown state entered: ' + stateName);
  state.handle(doc, stateDoc);
};

Pipeline.prototype._toState = function(doc, stateDoc, state) {
  // TODO
};

/***** Public ******/
Pipeline.prototype.push = function(doc, done) {
  var self = this
    , state = self.initialState;
    
  if (! this.db) return done(new Error('No database in use. Use pipeline.use(type, uri) to define a database.'))
  
  this.db.create({ state: state }, function(err, stateDoc) {
    if (err) return done(err);
    done(null, stateDoc.id);
    self._handleStateEntry(doc, stateDoc, state);
  });
};

Pipeline.prototype.on = function(stateName, handler, options) {
  var successState, errorState, priority, condition, state;
  
  if (! stateName) throw new Exception("invalid state name");
  if (typeof(handler) != "function") throw new Exception("invalid handler, should be a function");
  if (typeof(handler) != "object") throw new Exception("invalid options");
  
  successState = options.success || throw new Exception('options.success is required');
  errorState = options.success || 'error';
  priority = options.priority || DEFAULT_PRIORITY;
  condition = options.condition;
  state = this.states[stateName] || new State(stateName, this);
  this.states[statename] =  state;
  state.addTransition(handler, successState, errorState, priority, condition)
  
  this.emitter.on('state', handler);
};

Pipeline.prototype.use = function(type, uri) {
  this.db = DB.findByType(type) || throw new Exception('Unsupported DB type: ' + type);
  db.setUri(uri);
};

module.exports.newPipeline = Pipeline;