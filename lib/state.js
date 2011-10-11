var Transition = require('./transition');

function State(name, pipeline) {
  var transitions = [];
  if (! name) { throw new Error('Please define a name for this state.'); }
  if (! pipeline) { throw new Error('Please define a pipeline for this state.'); }

  function addTransition(handler, successState, priority, condition, undo) {
    var transition = Transition(this, handler, successState, priority, condition, undo);
    transitions.push(transition);
    transitions = transitions.sort(function(a, b) {
      return b.priority - a.priority;
    });
  }

  function handle(doc, stateDoc, done, logger) {
    var i = 0
      , transition;

    (function evaluateTransition() {
      if (transitions.hasOwnProperty(i)) {
        transition = transitions[i];
        transition.evaluateCondition(doc, stateDoc, function(err, passes) {
          try {
            if (err) { return done(err); }
            if (passes) {
                transition.trigger(doc, stateDoc, done, logger);
            } else {
              if ((i + 1) <= transitions.length) {
                i ++;
                evaluateTransition();
              } else {
                done(null, false);
              }
            }
          } catch (error) {
            done(error);
          }
        });
      }
    }());
  }
  
  function _name() {
    return name;
  }


  function toState(doc, stateDoc, state, done) {
    pipeline.toState(doc, stateDoc, state, done);
  }
  
  function undoTo(doc, from, done) {
    var relevantTransitions
      , transition;
      
    relevantTransitions = transitions.filter(function(transition) { return transition.successState() === undefined; });
    if (! relevantTransitions) {
      relevantTransitions = transitions.filter(function(transition) { return transition.successState() === from; });
    }
    
    if (relevantTransitions.length !== 1) {
      return done(new Error('Found ' + relevantTransitions.length + ' relevant transitions from state ' + from + ' into ' + name));
    }
    transition = relevantTransitions[0];
    if (transition.undo) {
      transition.undo(doc, done);
    } else {
      done();
    }
  }
  
  return {
      addTransition: addTransition
    , handle: handle
    , toState: toState
    , name: _name
    , undoTo: undoTo
  };

}

module.exports = State;