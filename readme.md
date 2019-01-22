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

### Options
参数在作用于服务启动的时候

option|description|value type
------|-----------|-----
'-i,  --instances \<n\>'|worker进程数,default 1|Number
'-p,  --port \<p\>'|egg应用启动监听端口|Number
'-t,  --title \<t\>'|egg应用名称|String
'-d,  --daemon'|守护进程模式，添加此参数后，服务启动后会进入后台守护进程模式|不需要参数值

## todo
- 添加command: startOrReload 自动判断是否需要启动或重启
- 支持所有egg-script参数
- 添加更多参数
- 优化ipc
- 想要什么，提issue吧
