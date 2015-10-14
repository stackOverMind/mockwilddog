'use strict';

var _        = require('lodash');
var assert   = require('assert');
var autoId   = require('firebase-auto-ids');
var Query    = require('./query');
var Snapshot = require('./snapshot');
var Queue    = require('./queue').Queue;
var utils    = require('./utils');
var Auth     = require('./auth');
var validate = require('./validators');

function MockWilddog (path, data, parent, name) {
  this.path = path || 'Mock://';
  this.errs = {};
  this.priority = null;
  this.myName = parent ? name : extractName(path);
  this.flushDelay = parent ? parent.flushDelay : false;
  this.queue = parent ? parent.queue : new Queue();
  this._events = {
    value: [],
    child_added: [],
    child_removed: [],
    child_changed: [],
    child_moved: []
  };
  this.parentRef = parent || null;
  this.children = {};
  if (parent) parent.children[this.key()] = this;
  this.sortedDataKeys = [];
  this.data = null;
  this._dataChanged(_.cloneDeep(data) || null);
  this._lastAutoId = null;
  _.extend(this, Auth.prototype, new Auth());
}

MockWilddog.ServerValue = {
  TIMESTAMP: {
    '.sv': 'timestamp'
  }
};

var getServerTime, defaultClock;
getServerTime = defaultClock = function () {
  return new Date().getTime();
};

MockWilddog.setClock = function (fn) {
  getServerTime = fn;
};

MockWilddog.restoreClock = function () {
  getServerTime = defaultClock;
};

MockWilddog.prototype.flush = function (delay) {
  this.queue.flush(delay);
  return this;
};

MockWilddog.prototype.autoFlush = function (delay) {
  if( _.isUndefined(delay)) {
    delay = true;
  }
  if (this.flushDelay !== delay) {
    this.flushDelay = delay;
    _.each(this.children, function (child) {
      child.autoFlush(delay);
    });
    if (this.parentRef) {
      this.parentRef.autoFlush(delay);
    }
  }
  return this;
};

MockWilddog.prototype.getFlushQueue = function() {
  return this.queue.getEvents();
};

MockWilddog.prototype.failNext = function (methodName, err) {
  assert(err instanceof Error, 'err must be an "Error" object');
  this.errs[methodName] = err;
};

MockWilddog.prototype.forceCancel = function (error, event, callback, context) {
  var events = this._events;
  (event ? [event] : _.keys(events))
    .forEach(function (eventName) {
      events[eventName]
        .filter(function (parts) {
          return !event || !callback || (callback === parts[0] && context === parts[1]);
        })
        .forEach(function (parts) {
          parts[2].call(parts[1], error);
          this.off(event, callback, context);
        }, this);
    }, this);
};

MockWilddog.prototype.getData = function () {
  return _.cloneDeep(this.data);
};

MockWilddog.prototype.getKeys = function () {
  return this.sortedDataKeys.slice();
};

MockWilddog.prototype.fakeEvent = function (event, key, data, prevChild, priority) {
  validate.event(event);
  if (arguments.length < 5) priority = null;
  if (arguments.length < 4) prevChild = null;
  if (arguments.length < 3) data = null;
  var ref = event === 'value' ? this : this.child(key);
  var snapshot = new Snapshot(ref, data, priority);
  this._defer('fakeEvent', _.toArray(arguments), function () {
    this._events[event]
      .map(function (parts) {
        return {
          fn: parts[0],
          args: [snapshot],
          context: parts[1]
        };
      })
      .forEach(function (data) {
        if ('child_added' === event || 'child_moved' === event) {
          data.args.push(prevChild);
        }
        data.fn.apply(data.context, data.args);
      });
  });
  return this;
};

MockWilddog.prototype.toString = function () {
  return this.path;
};

MockWilddog.prototype.child = function (childPath) {
  assert(childPath, 'A child path is required');
  var parts = _.compact(childPath.split('/'));
  var childKey = parts.shift();
  var child = this.children[childKey];
  if (!child) {
    child = new MockWilddog(utils.mergePaths(this.path, childKey), this._childData(childKey), this, childKey);
    this.children[child.key()] = child;
  }
  if (parts.length) {
    child = child.child(parts.join('/'));
  }
  return child;
};

MockWilddog.prototype.set = function (data, callback) {
  var err = this._nextErr('set');
  data = _.cloneDeep(data);
  this._defer('set', _.toArray(arguments), function() {
    if (err === null) {
      this._dataChanged(data);
    }
    if (callback) callback(err);
  });
};

MockWilddog.prototype.update = function (changes, callback) {
  assert.equal(typeof changes, 'object', 'First argument must be an object when calling "update"');
  var err = this._nextErr('update');
  this._defer('update', _.toArray(arguments), function () {
    if (!err) {
      var base = this.getData();
      var data = _.assign(_.isObject(base) ? base : {}, changes);
      this._dataChanged(data);
    }
    if (callback) callback(err);
  });
};

MockWilddog.prototype.setPriority = function (newPriority, callback) {
  var err = this._nextErr('setPriority');
  this._defer('setPriority', _.toArray(arguments), function () {
    this._priChanged(newPriority);
    if (callback) callback(err);
  });
};

MockWilddog.prototype.setWithPriority = function (data, pri, callback) {
  this.setPriority(pri);
  this.set(data, callback);
};

MockWilddog.prototype.key = function () {
  return this.myName;
};

/* istanbul ignore next */
MockWilddog.prototype.name = function () {
  console.warn('ref.name() is deprecated. Use ref.key()');
  return this.key.apply(this, arguments);
};

MockWilddog.prototype.ref = function () {
  return this;
};

MockWilddog.prototype.parent = function () {
  return this.parentRef;
};

MockWilddog.prototype.root = function () {
  var next = this;
  while (next.parentRef) {
    next = next.parentRef;
  }
  return next;
};

MockWilddog.prototype.push = function (data, callback) {
  var child = this.child(this._newAutoId());
  var err = this._nextErr('push');
  if (err) child.failNext('set', err);
  if (arguments.length && data !== null) {
    // currently, callback only invoked if child exists
    child.set(data, callback);
  }
  return child;
};

MockWilddog.prototype.once = function (event, callback, cancel, context) {
  validate.event(event);
  if (arguments.length === 3 && !_.isFunction(cancel)) {
    context = cancel;
    cancel = _.noop;
  }
  cancel = cancel || _.noop;
  var err = this._nextErr('once');
  if (err) {
    this._defer('once', _.toArray(arguments), function () {
      cancel.call(context, err);
    });
  }
  else {
    var fn = _.bind(function (snapshot) {
      this.off(event, fn, context);
      callback.call(context, snapshot);
    }, this);
    this._on('once', event, fn, cancel, context);
  }
};

MockWilddog.prototype.remove = function (callback) {
  var err = this._nextErr('remove');
  this._defer('remove', _.toArray(arguments), function () {
    if (err === null) {
      this._dataChanged(null);
    }
    if (callback) callback(err);
  });
  return this;
};

MockWilddog.prototype.on = function (event, callback, cancel, context) {
  validate.event(event);
  if (arguments.length === 3 && typeof cancel !== 'function') {
    context = cancel;
    cancel = _.noop;
  }
  cancel = cancel || _.noop;

  var err = this._nextErr('on');
  if (err) {
    this._defer('on', _.toArray(arguments), function() {
      cancel.call(context, err);
    });
  }
  else {
    this._on('on', event, callback, cancel, context);
  }
  return callback;
};

MockWilddog.prototype.off = function (event, callback, context) {
  if (!event) {
    for (var key in this._events) {
      /* istanbul ignore else */
      if (this._events.hasOwnProperty(key)) {
        this.off(key);
      }
    }
  }
  else {
    validate.event(event);
    if (callback) {
      var events = this._events[event];
      var newEvents = this._events[event] = [];
      _.each(events, function (parts) {
        if (parts[0] !== callback || parts[1] !== context) {
          newEvents.push(parts);
        }
      });
    }
    else {
      this._events[event] = [];      
    }
  }
};

MockWilddog.prototype.transaction = function (valueFn, finishedFn, applyLocally) {
  this._defer('transaction', _.toArray(arguments), function () {
    var err = this._nextErr('transaction');
    var res = valueFn(this.getData());
    var newData = _.isUndefined(res) || err? this.getData() : res;
    this._dataChanged(newData);
    if (typeof finishedFn === 'function') {
      finishedFn(err, err === null && !_.isUndefined(res), new Snapshot(this, newData, this.priority));
    }
  });
  return [valueFn, finishedFn, applyLocally];
};

MockWilddog.prototype./**
 * Just a stub at this point.
 * @param {int} limit
 */
limit = function (limit) {
  return new Query(this).limit(limit);
};

MockWilddog.prototype.startAt = function (priority, key) {
  return new Query(this).startAt(priority, key);
};

MockWilddog.prototype.endAt = function (priority, key) {
  return new Query(this).endAt(priority, key);
};

MockWilddog.prototype._childChanged = function (ref) {
  var events = [];
  var childKey = ref.key();
  var data = ref.getData();
  if( data === null ) {
    this._removeChild(childKey, events);
  }
  else {
    this._updateOrAdd(childKey, data, events);
  }
  this._triggerAll(events);
};

MockWilddog.prototype._dataChanged = function (unparsedData) {
  var pri = utils.getMeta(unparsedData, 'priority', this.priority);
  var data = utils.cleanData(unparsedData);

  if (utils.isServerTimestamp(data)) {
    data = getServerTime();
  }

  if( pri !== this.priority ) {
    this._priChanged(pri);
  }
  if( !_.isEqual(data, this.data) ) {
    var oldKeys = _.keys(this.data).sort();
    var newKeys = _.keys(data).sort();
    var keysToRemove = _.difference(oldKeys, newKeys);
    var keysToChange = _.difference(newKeys, keysToRemove);
    var events = [];

    keysToRemove.forEach(function(key) {
      this._removeChild(key, events);
    }, this);

    if(!_.isObject(data)) {
      events.push(false);
      this.data = data;
    }
    else {
      keysToChange.forEach(function(key) {
        var childData = unparsedData[key];
          if (utils.isServerTimestamp(childData)) {
            childData = getServerTime();  
          }
        this._updateOrAdd(key, childData, events);
      }, this);
    }

    // update order of my child keys
    this._resort();

    // trigger parent notifications after all children have
    // been processed
    this._triggerAll(events);
  }
};

MockWilddog.prototype._priChanged = function (newPriority) {
  if (utils.isServerTimestamp(newPriority)) {
    newPriority = getServerTime();
  }
  this.priority = newPriority;
  if( this.parentRef ) {
    this.parentRef._resort(this.key());
  }
};

MockWilddog.prototype._getPri = function (key) {
  return _.has(this.children, key)? this.children[key].priority : null;
};

MockWilddog.prototype._resort = function (childKeyMoved) {
  this.sortedDataKeys.sort(_.bind(this.childComparator, this));
  // resort the data object to match our keys so value events return ordered content
  var oldData = _.assign({}, this.data);
  _.each(oldData, function(v,k) { delete this.data[k]; }, this);
  _.each(this.sortedDataKeys, function(k) {
    this.data[k] = oldData[k];
  }, this);
  if( !_.isUndefined(childKeyMoved) && _.has(this.data, childKeyMoved) ) {
    this._trigger('child_moved', this.data[childKeyMoved], this._getPri(childKeyMoved), childKeyMoved);
  }
};

MockWilddog.prototype._addKey = function (newKey) {
  if(_.indexOf(this.sortedDataKeys, newKey) === -1) {
    this.sortedDataKeys.push(newKey);
    this._resort();
  }
};

MockWilddog.prototype._dropKey = function (key) {
  var i = _.indexOf(this.sortedDataKeys, key);
  if( i > -1 ) {
    this.sortedDataKeys.splice(i, 1);
  }
};

MockWilddog.prototype._defer = function (sourceMethod, sourceArgs, callback) {
  this.queue.push({
    fn: callback,
    context: this,
    sourceData: {
      ref: this,
      method: sourceMethod,
      args: sourceArgs
    }
  });
  if (this.flushDelay !== false) {
    this.flush(this.flushDelay);
  }
};

MockWilddog.prototype._trigger = function (event, data, pri, key) {
  var ref = event==='value'? this : this.child(key);
  var snap = new Snapshot(ref, data, pri);
  _.each(this._events[event], function(parts) {
    var fn = parts[0], context = parts[1];
    if(_.contains(['child_added', 'child_moved'], event)) {
      fn.call(context, snap, this._getPrevChild(key));
    }
    else {
      fn.call(context, snap);
    }
  }, this);
};

MockWilddog.prototype._triggerAll = function (events) {
  if (!events.length) return;
  events.forEach(function(event) {
    if (event !== false) this._trigger.apply(this, event);
  }, this);
  this._trigger('value', this.data, this.priority);
  if (this.parentRef) {
    this.parentRef._childChanged(this);
  }
};

MockWilddog.prototype._updateOrAdd = function (key, data, events) {
  var exists = _.isObject(this.data) && this.data.hasOwnProperty(key);
  if( !exists ) {
    return this._addChild(key, data, events);
  }
  else {
    return this._updateChild(key, data, events);
  }
};

MockWilddog.prototype._addChild = function (key, data, events) {
  if (!_.isObject(this.data)) {
    this.data = {};
  }
  this._addKey(key);
  this.data[key] = utils.cleanData(data);
  var child = this.child(key);
  child._dataChanged(data);
  if (events) events.push(['child_added', child.getData(), child.priority, key]);
};

MockWilddog.prototype._removeChild = function (key, events) {
  if(this._hasChild(key)) {
    this._dropKey(key);
    var data = this.data[key];
    delete this.data[key];
    if(_.isEmpty(this.data)) {
      this.data = null;
    }
    if(_.has(this.children, key)) {
      this.children[key]._dataChanged(null);
    }
    if (events) events.push(['child_removed', data, null, key]);
  }
};

MockWilddog.prototype._updateChild = function (key, data, events) {
  var cdata = utils.cleanData(data);
  if(_.isObject(this.data) && _.has(this.data,key) && !_.isEqual(this.data[key], cdata)) {
    this.data[key] = cdata;
    var c = this.child(key);
    c._dataChanged(data);
    if (events) events.push(['child_changed', c.getData(), c.priority, key]);
  }
};

MockWilddog.prototype._newAutoId = function () {
  return (this._lastAutoId = autoId(new Date().getTime()));
};

MockWilddog.prototype._nextErr = function (type) {
  var err = this.errs[type];
  delete this.errs[type];
  return err||null;
};

MockWilddog.prototype._hasChild = function (key) {
  return _.isObject(this.data) && _.has(this.data, key);
};

MockWilddog.prototype._childData = function (key) {
  return this._hasChild(key)? this.data[key] : null;
};

MockWilddog.prototype._getPrevChild = function (key) {
//      this._resort();
  var keys = this.sortedDataKeys;
  var i = _.indexOf(keys, key);
  if( i === -1 ) {
    keys = keys.slice();
    keys.push(key);
    keys.sort(_.bind(this.childComparator, this));
    i = _.indexOf(keys, key);
  }
  return i === 0? null : keys[i-1];
};

MockWilddog.prototype._on = function (deferName, event, callback, cancel, context) {
  var handlers = [callback, context, cancel];
  this._events[event].push(handlers);
  // value and child_added both trigger initial events when called so
  // defer those here
  if ('value' === event || 'child_added' === event) {
    this._defer(deferName, _.toArray(arguments).slice(1), function () {
      // make sure off() wasn't called before we triggered this
      if (this._events[event].indexOf(handlers) > -1) {
        switch (event) {
          case 'value':
            callback.call(context, new Snapshot(this, this.getData(), this.priority));
            break;
          case 'child_added':
            var previousChild = null;
            this.sortedDataKeys
              .forEach(function (key) {
                var child = this.child(key);
                callback.call(context, new Snapshot(child, child.getData(), child.priority), previousChild);
                previousChild = key;
              }, this);
            break;
        }
      }
    });
  }
};

MockWilddog.prototype.childComparator = function (a, b) {
  var aPri = this._getPri(a);
  var bPri = this._getPri(b);
  var x = utils.priorityComparator(aPri, bPri);
  if( x === 0 ) {
    if( a !== b ) {
      x = a < b? -1 : 1;
    }
  }
  return x;
};

function extractName(path) {
  return ((path || '').match(/\/([^.$\[\]#\/]+)$/)||[null, null])[1];
}

module.exports = MockWilddog;