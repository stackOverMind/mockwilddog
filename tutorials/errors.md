# 教程: 模拟错误

Except for user management methods like `createUser` that validate their arguments, MockWilddog calls will never results in asynchronous errors since all data is maintained locally. Instead, MockWilddog gives you two options for testing error handling behavior for both data and authentication methods:

除了用户管理方法,比如`createUser`验证他们的参数，MockWilddog调用不会产生异步错误，因为所有的操作都是在本地，MockWilddog 提供两个API来模拟错误

1. [`failNext(method, err)`](../API.md#failnextmethod-err---undefined): 规定下一次异步交互的回调函数会有一个参数err
2. [`forceCancel(err [, event] [, callback] [, context]`)](../API.md#forcecancelerr--event--callback--context---undefined): 强制取消监听


## `failNext`

Using `failNext` is a simple way to test behavior that handles write errors or read errors that occur immediately (e.g. an attempt to read a path a user is not authorized to view). 

使用`failNext` 是在读写

##### Source

```js
var log = {
  error: function (err) {
    console.error(err);
  }
};
var people = {
  ref: function () {
    return new Wilddog('htttps://example.wilddogio.com/people')
  },
  create: function (person) {
    people.ref().push(person, function (err) {
      if (err) log.error(err);
    });
  }
};
```

In our tests, we'll override `log.error` to ensure that it's properly called.

##### Test

```js
MockWilddog.override();
var ref = people.ref();
var errors = [];
log.error = function (err) {
  errors.push(err);
};
people.failNext('push');
people.create({
  first: 'Ben'
});
people.flush();
console.assert(errors.length === 1, 'people.create error logged');
```

## `forceCancel`

`forceCancel` simulates more complex errors that involve a set of event listeners on a path. `forceCancel` allows you to simulate Wilddog API behavior that would normally occur in rare cases when a user lost access to a particular reference. For a simple read error, you could use `failNext('on', err)` instead.

In this example, we'll also record an error when we lose authentication on a path.

##### Source
```js
people.ref().on('child_added', function onChildAdded (snapshot) {
  console.log(snapshot.val().first);
}, function onCancel () {
  log.error(err);
});
```

##### Test

```js
var errors = [];
log.error = function (err) {
  errors.push(err);
};
var err = new Error();
people.forceCancel(err, 'child_added');
console.assert(errors.length === 1, 'child_added was cancelled');
```
