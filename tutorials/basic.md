# 教程: MockWilddog 基础


当你用MockWilddog写单元测试的时候你一般会遇到以下两个场景。

1. 使用`on`读取数据
2. 使用`set` `push` 等写数据	
While your application almost certainly does both reading and writing to Wilddog, each test should try to cover as small a unit of functionality as possible.

你的应用总是会从wilddog 读数据和写数据，你应该把每一个测试分的尽量小。

##  测试读

在这个例子中，程序源代码中将会监听子节点被添加

##### Source

```js
var ref;
var people = {
  ref: function () {
    if (!ref) ref = new Wilddog('htttps://example.wilddogio.com/people');
    return ref;
  },
  greet: function (person) {
    console.log('hi ' + person.first);
  },
  listen: function () {
    people.ref().on('child_added', function (snapshot) {
      people.greet(snapshot.val());
    });
  }
};
```

在测试代码中，我们覆盖 `greet`方法，验证它是否正确的被调用

##### Test

```js
MockWilddog.override();
people.listen();
var greeted = [];
people.greet = function (person) {
  greeted.push(person);
};
ref.push({
  first: 'Michael'
});
ref.push({
  first: 'Ben'
});
ref.flush();
console.assert(greeted.length === 2, '2 people greeted');
console.assert(greeted[0].first === 'Michael', 'Michael greeted');
console.assert(greeted[1].first === 'Ben', 'Ben greeted');
```

我们通过调用  [`MockWilddog.override`](override.md) 来把真正的Wilddog对象替换成MockWilddog。如果你通过Node 或Browserify来加载，你需要使用[proxyquire](proxyquire.md)。


注意，我们会把多个数据变化放到队列里，只有`ref.flush`被调用是变化才会产生。队列中的数据变化按照产生的顺序排序。当需要监听，回调或其他异步返回的时候你需要调用`ref.flush`

## 测试写

使用MockWilddog测试写非常简单：

##### Source

```js
people.create = function (first) {
  return people.ref().push({
    first: first
  });
};
```

##### Test

```js
var newPersonRef = people.create('James');
ref.flush();
var autoId = newPersonRef.key();
var data = ref.getData();
console.assert(data[autoId].first === 'James', 'James was created');
```
