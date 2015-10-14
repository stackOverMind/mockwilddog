# 教程: 覆盖


当写单元测试的时候，用mock的方法替换真是的Wilddog的方法。
当`Wilddog` 绑定到window的时候,你可以用override方法

```js
MockFirebase.override();
```
现在，所有Wilddog的调用都会调用MockWilddog
