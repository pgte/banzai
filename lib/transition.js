var Transition = function(fromState, handler, successState, priority, condition) {
  this.fromState = fromState;
  this.handler = handler;
  this.successState = successState;
  this.priority = priority || 0;
  this.condition = condition;
};

Transition.prototype.evaluateCondition = function(doc) {
  var conditions = this.condition;
  if ((! conditions) || (Array.isArray(conditions) && conditions.length === 0)) {return true;}
  if (typeof(conditions) === 'function') {conditions = [conditions];}
  return conditions.every(function(condition) {
    if (typeof(condition) !== 'function') {return done(new Error('Given condition is not a function: ' + condition));}
    return condition(doc);
  });
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