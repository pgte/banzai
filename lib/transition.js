var Transition = function(fromState, handler, successState, priority, condition) {
  this.fromState = fromState;
  this.handler = handler;
  this.successState = successState;
  this.priority = priority || 0;
  this.condition = condition;
};

Transition.prototype.evaluateCondition = function(doc, stateDoc, callback) {
  var conditions = this.condition
    , respects = true
    , conditionIndex = 0;
  if ((! conditions) || (Array.isArray(conditions) && conditions.length === 0)) {return callback(null, true);}
  if (typeof(conditions) === 'function') {conditions = [conditions];}
  
  (function evaluateOne() {
    var ret
      , useCallback = true
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
    
    if (typeof(condition) !== 'function') { return callback(new Error('given condition is not a function: ' + condition)) }
    ret = condition(doc, function(err, ret) {
      if (useCallback) {
        if (err) return callback(err);
        evaluateRet(ret);
      }
    });
    if (typeof(ret) === 'boolean') {
      useCallback = false;
      evaluateRet(ret);
    }
  })();
};

Transition.prototype.error = function(doc, stateDoc, error) {
  this.fromState.toErrorState(doc, stateDoc, error);
};

Transition.prototype.trigger = function(doc, stateDoc) {
  var self = this
    , newState = false;
  this.handler(doc, function(err, newDoc) {
    if (err) {return self.error(doc, stateDoc, err);}
    if (typeof(newDoc) !== 'object') {return self.error(doc, stateDoc, new Error('Handler for state ' + self.fromState.name + ' calledback with a type of ' + (typeof newDoc)));}
    if (! newDoc) {return self.error(doc, stateDoc, new Error('Handler for state ' + self.fromState.name + ' called back with no document'));}
    if (self.successState) {
      newState = true;
      self.fromState.toState(newDoc, stateDoc, self.successState);
    }
  });
  return newState;
};

module.exports = Transition;