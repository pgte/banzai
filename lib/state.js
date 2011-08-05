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

State.prototype.handle = function(doc, stateDoc) {
  var i;
  var transition, selectedTransition;
  for (i in this.transitions) {
    if (this.transitions.hasOwnProperty(i)) {
      transition = this.transitions[i];
      if (transition.evaluateCondition(doc)) {
        selectedTransition = transition;
        break;
      }
    }
  }
  if (selectedTransition) {
    return selectedTransition.trigger(doc, stateDoc);
  }
  return false;
};


State.prototype.toState = function(doc, stateDoc, state) {
  this.pipeline._toState(doc, stateDoc, state);
};

State.prototype.toErrorState = function(doc, stateDoc, error) {
  this.pipeline._toErrorState(doc, stateDoc, error);
};

module.exports = State;