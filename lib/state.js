var State = function(name, pipeline) {
  this.pipeline = pipeline;
  this.name = name;
  this.transitions = [];
};

State.prototype.addTransition = function() {
  var transition = new Transition(this, handler, successState, errorState, priority, condition)
  this.transitions.push(transition);
  transitions = transitions.sort(function(a, b) {
    return a.priority - b.priority;
  });
};

State.prototype.handle = function(doc, stateDoc) {
  var transition, selectedTransition;
  for (var i in transitions) {
    transition = transitions[i];
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
  if (! doc.errors) doc.errors = [];
  doc.errors.push(error);
  this.pipeline._toState(doc, stateDoc, state);
};

module.exports = State;