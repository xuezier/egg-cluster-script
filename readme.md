# eggjs 部署脚本
仿造egg-script的集群热部署方案，支持单机集群的热部署平滑重启更新

支持egg-script启动日志

*采用ipc通信代替agent-worker管理worker的重启*，官方的agent-worker太复杂，先代替一下

## installation
```bash
npm install egg-cluster-script --save-dev
```

## usage
```
npx eggcbl <command> [...options]
```

### Command
command|description
-------|-----------
start|启动服务
stop|终止服务
reload|重启集群，平滑模式
startOrReload|启动/重启服务，自动根据title判断

### Options
参数在作用于服务启动的时候

option|description|value type
------|-----------|-----
'-i,  --instances \<n\>'|worker进程数,default 1|Number
'-p,  --port \<p\>'|egg应用启动监听端口|Number
'-t,  --title \<t\>'|egg应用名称|String
'-d,  --daemon'|守护进程模式，添加此参数后，服务启动后会进入后台守护进程模式|不需要参数值
'-l,  --logDir \<d\>'|日志保存目录|String
'-b,  --baseDir \<d\>'|项目启动目录|String
'-ig, --ignore-stderr'|忽略错误信息启动|不需要参数值

*title 参数使用在所有的命令中*

## closehook
在worker重启的过程中，应该及时切走流量，让正在重启的 worker 不再接收新的请求，并在超时时间内处理好已经连接的请求，

如果正在连接的请求超过了超时时间，那么 worker 就已经被关闭了，这些请求会返回错误
```javascript
//app.js

module.exports = app => {

    app.beforeClose(async() => {
        const server = app.server;
        // 在worker重启的时候，禁止新的请求访问
        server.close();
        // 访问请求超时
        await new Promise(resolve => setTimeout(resolve, 5000));
    });

}

```
app-worker 在接收到关闭命令的时候，会触发这个钩子，终止新的请求，并在 5s 后被关闭，如果 5s 内已请求的连接没有完成，会被释放

## todo
- ✅ 添加command: startOrReload 自动判断是否需要启动或重启
- 支持所有egg-script参数
- 🔥 添加更多参数
- 🔥 优化ipc
- 想要什么，提issue吧
