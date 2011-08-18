var Transition = require('./transition');

var State = function(name, pipeline) {
  this.pipeline = pipeline;
  this.name = name;
  this.transitions = [];
};

State.prototype.addTransition = function(handler, successState, priority, condition) {
  var transition = new Transition(this, handler, successState, priority, condition);
  this.transitions.push(transition);
  this.transitions = this.transitions.sort(function(a, b) {
    return b.priority - a.priority;
  });
};

State.prototype.handle = function(doc, stateDoc, done, logger) {
  var self = this
    , i = 0
    , transition;
  
  (function evaluateTransition() {
    if (self.transitions.hasOwnProperty(i)) {
      transition = self.transitions[i];
      transition.evaluateCondition(doc, stateDoc, function(err, passes) {
        if (err) { return done(err); }
        if (passes) {
          try {
            done(null, transition.trigger(doc, stateDoc, logger));
          } catch (err) {
            self.toErrorState(doc, stateDoc, err);
          }
        } else {
          if ((i + 1) <= self.transitions.length) {
            i ++;
            evaluateTransition();
          } else {
            done(null, false);
          }
        }
      });
    }
  })();
};


State.prototype.toState = function(doc, stateDoc, state) {
  this.pipeline._toState(doc, stateDoc, state);
};

State.prototype.toErrorState = function(doc, stateDoc, error) {
  this.pipeline._toErrorState(doc, stateDoc, error);
};

module.exports = State;