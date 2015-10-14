MockWilddog [![Build Status](https://travis-ci.org/stackOverMind/mockwilddog.svg?branch=master)](https://travis-ci.org/stackOverMind/mockwilddog)
============


## Setup

### Node/Browserify

```bash
$ npm install mockwilddog
```

```js
var MockWilddog = require('mockwilddog').MockWilddog;
```

### AMD/Browser

```bash
$ bower install mockwilddog
```

```html
<script src="./bower_components/mockwilddog/browser/mockwilddog.js"></script>
```

## API

MockWilddog 支持 [Wilddog API](https://z.wilddog.com/web/api) 增加了 [API Reference](API.md) 中提到的API. MockWilddog可以在不连接服务器的情况下模拟同步和异步操作和事件 ([`ref.flush`](API.md#flushdelay---ref)).

## 教程

* [基础](tutorials/basic.md)
* [Auth](tutorials/authentication.md)
* [模拟错误](tutorials/errors.md)
* [覆盖`window.Wilddog`](tutorials/override.md)
* [覆盖`require('wilddog')`](tutorials/proxyquire.md)
