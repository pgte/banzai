# To do

* Extract kue/redis jobs dependency into banzai-redis
* Make banzai-redis configurable
* Build banzai-cqs (couchdb queueing)
* Add transition log into stateDoc with properties
  * initial state
  * started at
  * ended at
  * next state
* Review handler API. Make use of scoping this.* instead of using tons of arguments.
* Plugin architecture for stateDoc reading and writing. Extract banzai-couchdb. Stop using pipeline.use('couch'). Instead pass in plugin object.
