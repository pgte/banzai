var Transition = require('./transition');

var State = function(name, pipeline) {
  if (! name) { throw new Error('Please define a name for this state.'); }
  if (! pipeline) { throw new Error('Please define a pipeline for this state.'); }
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
        try {
          if (err) { return done(err); }
          if (passes) {
              transition.trigger(doc, stateDoc, done, logger);
          } else {
            if ((i + 1) <= self.transitions.length) {
              i ++;
              evaluateTransition();
            } else {
              done(null, false);
            }
          }
        } catch (err) {
          done(err);
        }
      });
    }
  })();
};


State.prototype.toState = function(doc, stateDoc, state, done) {
  this.pipeline._toState(doc, stateDoc, state, done);
};

module.exports = State;