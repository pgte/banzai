var Transition = function(fromState, handler, successState, priority, condition) {
  this.fromState = fromState;
  this.handler = handler;
  this.successState = successState;
  this.priority = priority || 0;
  this.condition = condition;
};

var noop = function() {};

Transition.prototype.evaluateCondition = function(doc, stateDoc, callback) {
  var conditions = this.condition
    , respects = true
    , conditionIndex = 0
    , meta
    , context;

  if ((! conditions) || (Array.isArray(conditions) && conditions.length === 0)) {return callback(null, true);}
  if (typeof(conditions) === 'function') {conditions = [conditions];}
  
  meta = stateDoc.meta;
  if (! meta) {
    meta = {};
    stateDoc.meta = meta;
  }
  
  context = {
    meta: meta
  };
  
  (function evaluateOne() {
    var ret
      , useCallback = true
      , calledBack = false
      , condition = conditions[conditionIndex];
      
    function evaluateRet(ret) {
      if (! ret) {
        callback(null, false);
      } else {
        if ((conditionIndex + 1) < conditions.length) {
          conditionIndex ++;
          evaluateOne();
        } else {
          callback(null, true);
        }
      }
    }
    
    if (typeof(condition) !== 'function') { return callback(new Error('given condition is not a function: ' + condition)); }
    
    ret = condition.call(context, doc, function(err, ret) {
      calledBack = true;
      if (useCallback) {
        if (err) return callback(err);
        evaluateRet(ret);
      }
    });
    if (! calledBack && typeof(ret) === 'boolean') {
      useCallback = false;
      evaluateRet(ret);
    }
  })();
};

Transition.prototype.trigger = function(doc, stateDoc, done, logger) {
  try {
    var self = this
      , context;
    
    if (! logger) { logger = noop; }

    function loggerLogger(what) {
      logger('[' + self.fromState.name + ' -> ' + (self.successState || 'undefined') + '] [handler' + (self.handler.name ? (' ' + self.handler.name) : '' ) + '] ' + what);
    };

    logger('[transition] Triggering state "' + self.fromState.name + '"');

    if (! stateDoc.meta) { stateDoc.meta = {}; }
    
    context = {
        log: loggerLogger
      , meta: stateDoc.meta
    };
    
    this.handler.call(context, doc, function(err, newDoc) {
      if (err) {return done(err); }
    
      if (newDoc === undefined) newDoc = doc;
      
      if (typeof(newDoc) !== 'object') { return done(new Error('Handler for state ' + self.fromState.name + ' calledback with a type of ' + (typeof newDoc))); }
      if (! newDoc) { return done(new Error('Handler for state ' + self.fromState.name + ' called back with no document')); }
      
      if (self.successState) {
        logger('[transition] To state "' + (self.successState || 'undefined') + '"');
        self.fromState.toState(newDoc, stateDoc, self.successState, function(err) {
          if (err) { return done(err); }
          done(null, true);
        });
      } else {
        done(null, false);
      }
    });
  } catch(err) {
    done(err);
  }
};

module.exports = Transition;