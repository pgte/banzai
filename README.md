# Intro

`Banzai` (short for BanzaiETL) is a document processing framework. It operates by defining pipelines. We have a `PubSub` model where publishers (e.g. our api) place things in a priority queue that then gets consumed by a pipeline worker. A pipeline worker subscribes to the work queue and when it finds a task that needs to be done starts working on it. A pipeline is basically a state machine that allows you to execute multiple operations on a single file. You can use it to enrich documents with stuff from the internet, convert images, replicate a database to another datastore, etc. In our case we use the pipelines to process emails, convert pdf attachments to images, resize images, process information we get from mechanical turk, etc.

# Terminology

## Pipeline

You can define one or more pipelines like this:

    var banzai = require('banzai');
    var pipeline = banzai.pipeline('my user pipeline');

The pipeline object has a chainable configuration API which you can use to later configure this object.

To start with, a pipeline processes documents in a document store.

## States and Transitions

Each document that enters a pipeline has a state at each moment in time.

You can trigger a handle when a document state changes. This handle is a function that receives the document and then transforms it.

You can define the pipeline states and transitions like this:

    var initialHandler = function(doc, done) {
      doc.a = doc.a + 1;
      done(null, doc);
    };

    pipeline
        .on('initial', initialHandler, {
          success: ''
        })
        .on('');

### Error handling

TODO!!!!

## Document Store

Each pipeline has a document store, which is where the docs that are processed are stored.

You can define the document store on a pipeline like this:

    pipline.docStore(docStore);

A doc store is an object that has to have these 2 functions:

* load(docId, callback) - callback is a function with the signature (err, doc);
* save(doc, callback) - callback is a function with the signature (err, doc);

By convention, you should expect doc.id or doc._id if the document exists and update it.

There already exists a store for CouchDB named [banzai-docstore-couchdb]. You can install it like this:

    $ cd <PROJECT ROOT DIR>
    $ npm install banzai-docstore-couchdb

... and use it like this:

    var banzaiDocstoreCouchdb = require('banzai-docstore-couchdb');
    var docStore = banzaiDocstoreCouchdb({
        url: 'http://localhost:5984'
      , db: 'docs'
    });
    pipeline.docStore(docStore);

## State Store

Each pipeline has a state store, which is where the document states are stored.

(If you don't define a state store, the document state will be stored inside a "state" property of your document).

A state store is an object that has to have these 2 functions:

* load(stateDocId, callback) - callback is a function with the signature (err, doc);
* save(stateDoc, callback) - callback is a function with the signature (err, doc);

By convention, you should expect doc.id or doc._id if the document exists and update it.

There already exists a state store for CouchDB named [banzai-statestore-couchdb]. You can install it like this:

    $ cd <PROJECT ROOT DIR>
    $ npm install banzai-statestore-couchdb

... and use it like this:

    var banzaiStatestoreCouchdb = require('banzai-statestore-couchdb');
    var stateStore = banzaiDocstoreCouchdb({
        url: 'http://localhost:5984'
      , db: 'states'
    });
    pipeline.stateStore(stateStore);

## Work Queue

A work queue is a queue where pending transitions are put so that they are picked up by interested workers.

Each pipeline has a work queue, which is an object that has to have these functions:

* push(state_name, jobData, callback)
  * state_name: a string to identify the state;
  * jobData: an object to be passed onto the worker
  * callback: a function with the signature (err).
* pop(state_name, callback)
  * state_name
  * callback: a function with the signature (err, jobData).

[banzai-docstore-couchdb]: https://github.com/pgte/banzai-docstore-couchdb
[banzai-statestore-couchdb]: https://github.com/pgte/banzai-statestore-couchdb