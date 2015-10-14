# 教程: 认证操作


MockWilddog 使用一个简单的mock模拟Wilddog的大多数auth行为。除非`failNext`被调用，认证操作总是会返回正确[`failNext`](../API.md#failnextmethod-err---undefined)。MockWilddog 并不会跟服务器进行交互，而是在本地存一个用户列表

## 创建用户

在这个例子中,我们会用代码创建一个新用户，并测试是否写到了Wilddog中

##### Source

```js
var users = {
  ref: function () {
    return new Wilddog('https://example.wilddogio.com');
  }
  create: function (credentials, callback) {
    users.ref().createUser(credentials, callback);
  }
};
```

##### Test

```js
MockWilddog.override();
var ref = users.ref();
users.create({
  email: 'ben@example.com',
  password: 'examplePass'
});
users.flush();
console.assert(users.getEmailUser('ben@example.com'), 'ben was created');
```

## 手动改变用户认证状态


MockWilddog 提供的 `changeAuthState`方法可以改变用户的认证状态。可以用来模拟很多场景，如用户的登录登出

这个例子中，我们希把管理员用户望重定向到管理控制面板。

##### Source

```js
users.ref().onAuth(function (authData) {
  if (authData.auth.isAdmin) {
    document.location.href = '#/admin';
  }
});
```

##### Test

```js
ref.changeAuthState({
  uid: 'testUid',
  provider: 'custom',
  token: 'authToken',
  expires: Math.floor(new Date() / 1000) + 24 * 60 * 60,
  auth: {
    isAdmin: true
  }
});
ref.flush();
console.assert(document.location.href === '#/admin', 'redirected to admin');
```
