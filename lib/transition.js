var Transition = function(fromState, handler, successState, priority, condition) {
  this.fromState = fromState;
  this.handler = handler;
  this.successState = successState;
  this.priority = priority || 0;
  this.condition = condition;
};

Transition.prototype.evaluateCondition = function(doc) {
  var conditions = this.condition;
  if ((! conditions) || (Array.isArray(conditions) && conditions.length === 0)) return true;
  if (typeof(conditions) == 'function') conditions = [conditions];
  return conditions.every(function(condition) {
    if (typeof(condition) != 'function') return done(new Error('Given condition is not a function: ' + condition));
    return condition(doc);
  });
};

Transition.prototype.error = function(doc, stateDoc, error) {
  this.fromState.toErrorState(doc, stateDoc, error);
};

Transition.prototype.trigger = function(doc, stateDoc) {
  var self = this;
  this.handler(doc, function(err) {
    if (err) return self.error(doc, stateDoc, err);
    self.fromState.toState(doc, stateDoc, self.successState);
  });
};

module.exports = Transition;