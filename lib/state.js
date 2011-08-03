var Transition = require('./transition');

var State = function(name, pipeline) {
  this.pipeline = pipeline;
  this.name = name;
  this.transitions = [];
};

State.prototype.addTransition = function(handler, successState, errorState, priority, condition) {
  var transition = new Transition(this, handler, successState, errorState, priority, condition)
  this.transitions.push(transition);
  this.transitions = this.transitions.sort(function(a, b) {
    return b.priority - a.priority;
  });
};

State.prototype.handle = function(doc, stateDoc) {
  var transition, selectedTransition;
  for (var i in this.transitions) {
    transition = this.transitions[i];
    if (transition.evaluateCondition(doc)) {
      selectedTransition = transition;
      break;
    }
  }
  if (selectedTransition) selectedTransition.trigger(doc, stateDoc);
};


State.prototype.toState = function(doc, stateDoc, state) {
  this.pipeline._toState(doc, stateDoc, state);
};

State.prototype.toErrorState = function(doc, stateDoc, state, error) {
  if (! stateDoc.errors) stateDoc.errors = [];
  stateDoc.errors.push(error);
  this.pipeline._toState(doc, stateDoc, state);
};

module.exports = State;