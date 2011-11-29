# Intro

`Banzai` (short for BanzaiETL) is a document processing framework. It operates by defining pipelines.

You define a pipeline, launch a worker or more, push a document and it goes through the pipeline, ending in an ended (or in a 'error') state.
A pipeline is basically a state machine that allows you to execute multiple operations on a single file
You can use it to enrich documents with stuff from the internet, convert images, replicate a database to another datastore, etc. In our case we use the pipelines to process emails, convert pdf attachments to images, resize images, process information we get from mechanical turk, etc.

You can programmatically roll-back a given document to a given state and play it again. For instance, if your document yields an error and you find out the error is because of a bug in your code, or you simply want to try that document again, you roll it back to a previous state and play the document.

## Architecture

Each pipeline has a _Doc Store_. This is where the documents are saved into. The Doc Store can be a CouchDB database (if you use banzai-couchdb-store), or you can define your own if you define an object that has a `load` and a `save` functions (read below).

Each pipeline can have a _State Store_. This is where the state for a document in a pipeline is stored. The State Store can be, again, a CouchDB database (if you use banzai-couchdb-store), or you can again define your own if you define an object that has a `load` and a `save` functions (read below).

_Banzai Clients_ just get a handle on the pipeline and push document to it.

_Banzai Workers_ are listening for work on a queue. They listen for state transitions they are interested in and process them. Then the document transitions state, is stored and another worker can take it from there.

So, workers listen on a queue. Right now we have Redis queueing support by installing the banzai-redis package.

## Install

    npm install banzai

If you want to work with a CouchDB State or Doc stores you need to:

    npm install banzai-couchdb-store

You should also install the [banzai-redis] package to support queueing.

    npm install banzai-redis

You should install Redis - it has to be a version that supports the [BRPOPLPUSH] command.

# Terminology

## Pipeline

You can define one or more pipelines like this:

    var banzai = require('banzai');
    var pipeline = banzai.pipeline('order pipeline');

The pipeline object has a chainable configuration API which you can use to later configure this object.

To start with, a pipeline processes documents in a document store.

## States and Transitions

Each document that enters a pipeline has a state at each moment in time.

You can trigger a handle when a document state changes. This handle is a function that receives the document and then transforms it.

You can define the pipeline states and transitions like this:

    pipeline
        .on('initial', initialHandler, {
            next: 'order received email sent'
        })
        .on('order received email sent', orderEmailSentHandler, {
            priority: 2
          , condition: allItemsAvailable
          , next: 'items available'
        })
        .on('order received email sent', confirmationEmailSentHandler, {
            priority: 1
          , next: 'items not available'
        })
        .on('items not available', itemsNotAvailableHandler)
        .on('items available', itemsAvailableHandler, {
          next: 'order placed'
        })
        .on('order placed', orderPlacedHandler, {
          next: 'order placed email sent'
        });


### State handlers

`initlalHandler`, `orderEmailSentHandler`, `itemsNotAvailableHandler` and all the others are functions that handle the state entry. They could look something like this;

    var initialHandler = function(orderDoc, done) {
      email.sendOrderReceivedEmail(orderDoc, done);
    };

    var confirmationEmailSentHandler = function(orderDoc, done) {
      done();
    };

    var itemsNotAvailableHandler = function(orderDoc, done) {
      email.sendItemsNotAvailable(orderDoc, done);
    };


It is necessary that the handlers call the done function once they are done. If an error occurs, done should be called with an error on the first argument. If not, the first argument should be `null`.

You can see that the `confirmationEmailSentHandler` handler does not pass the document to the callback function. If that happens, the previous version of the document is used.

#### Condition functions

`allItemsAvailable` is a condition function, which could look something like this;

    var allItemsAvailable = function(orderDoc, done) {
      inventory.checkAvailabilityAndReserveItems(orderDoc.items, function(err, availability) {
        if (err) { return done(err); }
        done(null, availability.allAvailable);
      });
    };

A condition function should either return a boolean or call the `done` function with `(err, boolean)`. The first argument should be null if there is no error and the second argument should be a boolean, telling if the condition was met or not.

## Document Store

Each pipeline has a document store, which is where the docs that are processed are stored.

You can define the document store on a pipeline like this:

    pipline.docStore(docStore);

A doc store is an object that has to have these 2 functions:

* load(docId, callback) - callback is a function with the signature (err, doc);
* save(doc, callback) - callback is a function with the signature (err, doc);

By convention, you should expect doc.id or doc._id if the document exists and update it.

There already exists a store for CouchDB named [banzai-couchdb-store]. You can install it like this:

    $ cd <PROJECT ROOT DIR>
    $ npm install banzai-couchdb-store

... and use it like this:

    var banzaiDocstoreCouchdb = require('banzai-couchdb-store');
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

There already exists a state store for CouchDB named [banzai-couchdb-store]. You can install it like this:

    $ cd <PROJECT ROOT DIR>
    $ npm install banzai-couchdb-store

... and use it like this:

    var banzaiStatestoreCouchdb = require('banzai-couchdb-store');
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

# Meta-data

Each job can store meta-data pertaining to the current document.

It's accessible to state handlers inside the `this.meta` property.

# Pipeline options

When defining a pipeline you can pass a second argument with some options:

* stateStore - the state store. By default is `undefined`. If stateStore is `undefined` then the state will be embedded in document.
* docStore - the document store. No default value. Must be defined.
* embedStateInDocProp - What property to embed the state in the document. Only used if `stateStore` is not used. Defaults to 'state'.
* initialState - defaults to 'initial'
* errorState   - The state the document is put if an error occurs. Defaults to 'error'.
* queue - the queueing mechanism. You can use `require('banzai-redis')` as value.
* info - logger function for `info`-log-level messages that accepts a string as sole argument and logs it. Defaults to `no operation`.
* error - logger function that accepts a string as sole argument and logs it. Defaults to `console.log`.
* verbose - logger function for `verbose`-log-level messages that accepts a string as sole argument and logs it. Defaults to `no operation`. Prints transitions and some other interesting stuff.

# Error handling

If an error occurs, the document is set into the error state. You can observe the errors - they are embedded into the state document `errors` property.

# Meta-info

All the transitions are stored inside the state document, inside the `transitions` property.

[banzai-couchdb-store]: https://github.com/pgte/banzai-couchdb-store
[banzai-redis]: https://github.com/pgte/banzai-redis
[BRPOPLPUSH]: http://redis.io/commands/brpoplpush

# License

(The MIT License)

Copyright (c) 2011 Pedro Teixeira. http://about.me/pedroteixeira

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

FUCK YEAH.