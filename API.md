# API Reference

这里只包含 `MockWilddog`的API。Wilddog的API请参考[Wilddog Web API 文档](https://z.wilddog.com/web/api)

- [Core](#core)
  - [`flush([delay])`](#flushdelay---ref)
  - [`autoFlush([delay])`](#autoflushdelaysetting---ref)
  - [`failNext(method, err)`](#failnextmethod-err---undefined)
  - [`forceCancel(err [, event] [, callback] [, context]`)](#forcecancelerr--event--callback--context---undefined)
  - [`getData()`](#getdata---any)
  - [`getKeys()`](#getkeys---array)
  - [`fakeEvent(event [, key] [, data] [, previousChild] [, priority])`](#fakeeventevent--key--data--previouschild--priority---ref)
  - [`getFlushQueue()`](#getflushqueue---array)
- [Auth](#auth)
  - [`changeAuthState(user)`](#changeauthstateauthdata---undefined)
  - [`getEmailUser(email)`](#getemailuseremail---objectnull)
- [Server Timestamps](#server-timestamps)
  - [`setClock(fn)`](#wilddogsetclockfn---undefined)
  - [`restoreClock()`](#wilddogsetclockfn---undefined)

## Core

`Core`中的函数是用来mock数据处理行为的

##### `flush([delay])` -> `ref`

将队列中的数据和操作flush出去。如果传入一个`delay`，flush操作将在 delay 毫秒后触发

在MockWilddog中，数据操作可以同步执行。调用任何Wilddog的API，MockWilddog都会把操作储存在队列中。你可在flush之前调用多次操作。MockWilddog会按照调用的顺序执行这些操作。如果你在一个操作中调用了另外一个操作。所有的改变都会在同一个flush中。

如果队列为空`flush` 会抛出一个异常

Example:

```js
ref.set({
  foo: 'bar'
});
console.assert(ref.getData() === null, 'ref does not have data');
ref.flush();
console.assert(ref.getData().foo === 'bar', 'ref has data');
```

<hr>

##### `autoFlush([delay|setting])` -> `ref`


配置Wilddog自动flush数据和auth操作。如果没有参数或参数设置true，操作会立刻flush(同步)。如果提供`delay`参数，操作会在delay毫秒后自动flush
<hr>

##### `failNext(method, err)` -> `undefined`

指定下一个操作失败，用来模拟数据操作，auth失败的情况
`err`是`Error`实例

Example:

```js
var error = new Error('Oh no!');
ref.failNext('set', error);
var err;
ref.set('data', function onComplete (_err_) {
  err = _err_;
});
console.assert(typeof err === 'undefined', 'no err');
ref.flush();
console.assert(err === error, 'err passed to callback');
```

<hr>

##### `forceCancel(err [, event] [, callback] [, context]` -> `undefined`

取消监听,模拟被取消监听操作。
Example:

```js
var error = new Error();
function onValue (snapshot) {}
function onCancel (_err_) {
  err = _err_; 
}
ref.on('value', onValue, onCancel);
ref.flush();
ref.forceCancel(error, 'value', onValue);
console.assert(err === error, 'err passed to onCancel');
```

<hr>

##### `getData()` -> `Any`

获取当前数据。在getData之前一定要flush

<hr>

##### `getKeys()` -> `Array`

返回当前节点下的所有key
<hr>

##### `fakeEvent(event [, key] [, data] [, previousChild] [, priority])` -> `ref`

触发一个假的事件，如果是子节点变动,需要传入事件名，变化的子节点,数据，前一个子节点，优先级等数据。如果是value事件，不需要传入 key
Example:

```js
var snapshot;
function onValue (_snapshot_) {
  snapshot = _snapshot_;
}
ref.on('value', onValue);
ref.set({
  foo: 'bar';
});
ref.flush();
console.assert(ref.getData().foo === 'bar', 'data has foo');
ref.fakeEvent('value', undefined, null);
ref.flush();
console.assert(ref.getData() === null, 'data is null');
```

<hr>

##### `getFlushQueue()` -> `Array`

获取事件队列里的所有操作的拷贝,每一个事件包含属性 `sourceMethod` `sourceArguments`

Example:

```js
// create some child_added events
var ref = new MockWilddog('OutOfOrderFlushEvents://');

var child1 = ref.push('foo');
var child2 = ref.push('bar');
var child3 = ref.push('baz');
var events = ref.getFlushQueue();

var sourceData = events[0].sourceData;
console.assert(sourceData.ref === child2, 'first event is for child1');
console.assert(sourceData.method, 'first event is a push');
console.assert(sourceData.args[0], 'push was called with "bar"');

ref.on('child_added', function (snap, prevChild) {
   console.log('added ' + snap.val() + ' after ' + prevChild);
});

// cancel the second push so it never triggers a event
events[1].cancel();
// trigger the third push before the first
events[2].run(); // added baz after bar
// now flush the remainder of the queue normally
ref.flush(); // added foo after null
```

## Auth

模拟Auth操作和事件

##### `changeAuthState(authData)` -> `undefined`


`authData` should adhere to the [documented schema](https://www.wilddog.com/docs/web/api/wilddog/onauth.html).

改变当前Auth状态,`authData` 请参考[doc](https://z.wilddog.com/web/api#onAuth-0)
Example:

```js
ref.changeAuthState({
  uid: 'theUid',
  provider: 'github',
  token: 'theToken',
  expires: Math.floor(new Date() / 1000) + 24 * 60 * 60, // expire in 24 hours
  auth: {
    myAuthProperty: true
  }
});
ref.flush();
console.assert(ref.getAuth().auth.myAuthProperty, 'authData has custom property');
```

<hr>

##### `getEmailUser(email)` -> `Object|null`

获取使用 createUser接口创建的用户email

## Server Timestamps

MockWilddog 允许模拟服务端时间戳

##### `Wilddog.setClock(fn)` -> `undefined`

设置服务端生成时间戳的函数

<hr>

##### `Wilddog.restoreClock()` -> `undefined`

恢复默认的服务端生成时间戳的函数
