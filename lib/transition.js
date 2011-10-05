var inspect = require('util').inspect;

var noop = function() {};

function Transition(fromState, handler, successState, priority, condition) {
  if (! priority) { priority = 0; }

  function evaluateCondition(doc, stateDoc, callback) {
    var conditions = condition
      , respects = true
      , conditionIndex = 0
      , meta
      , context;

    if ((! conditions) || (Array.isArray(conditions) && conditions.length === 0)) { return callback(null, true); }
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

      if (typeof(condition) !== 'function') { return callback(new Error('given condition is not a function: ' + inspect(condition))); }

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

  function trigger(doc, stateDoc, done, logger) {
    try {
      var self = this
        , context;

      if (! logger) { logger = noop; }

      function loggerLogger(what) {
        logger('[' + fromState.name + ' -> ' + (successState || 'undefined') + '] [handler' + (handler.name ? (' ' + handler.name) : '' ) + '] ' + what);
      };

      logger('[transition] Triggering state "' + fromState.name + '"');

      if (! stateDoc.meta) { stateDoc.meta = {}; }

      context = {
          log: loggerLogger
        , meta: stateDoc.meta
      };

      handler.call(context, doc, function(err, newDoc) {
        if (err) {return done(err); }

        if (newDoc === undefined) newDoc = doc;

        if (typeof(newDoc) !== 'object') { return done(new Error('Handler for state ' + fromState.name + ' calledback with a type of ' + (typeof newDoc))); }
        if (! newDoc) { return done(new Error('Handler for state ' + fromState.name + ' called back with no document')); }

        if (successState) {
          logger('[transition] To state "' + (successState || 'undefined') + '"');
          fromState.toState(newDoc, stateDoc, successState, function(err) {
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
  
  return {
      evaluateCondition : evaluateCondition
    , trigger: trigger
  };

};


module.exports = Transition;