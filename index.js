module.exports = class Command {
    constructor() {
        this.helper = require('./lib/helper');

        const env = process.env;
        const { PORT, INSTANCES } = env;

        this.poc_argvs = {
            command: process.execPath || 'node',
            baseDir: process.cwd(),                 // 运行目录
            instances: +INSTANCES || 1,             // worker数量
            // port: +PORT || 7001,                    // 启动端口
            framework: 'egg',
            isDaemon: false,                         // 守护进程模式
        };

        this.commander = null;
    }

    async start() {
        this.commander = require('./lib/commander');

        this._stop();
        this._reload();
        this._startOrReload();
        this._start();
    }

    setInstances() {
        this.commander.option('-i, --instances <n>', 'max workers num of cluster mode', (num = 1) => {
            const instances = +num;
            if(isNaN(instances) || instances <= 0) {
                instances = 1;
            }
            this.poc_argvs.instances = instances;
        });

        return this;
    }

    setPort() {
        this.commander.option('-p, --port <n>', 'set egg app listening port', (port = 7001) => {
            this.poc_argvs.port = +port;
        });

        return this;
    }

    setTitle() {
        this.commander.option('-t, --title <t>', 'set application title', title => {
            this.poc_argvs.title = title;
        });

        return this;
    }

    setIsDaemon() {
        this.commander.option('-d, --daemon', 'open daemon', () => {
            this.poc_argvs.isDaemon = true;
        });

        return this;
    }


    _start() {
        this.commander.command('start');

        this.setInstances()
        .setPort()
        .setTitle()
        .setIsDaemon()
        .commander.action(async () => {
            await require('./lib/stop').stop();
            await require('./lib/start').start(this.poc_argvs);
        })

        this.commander.parse(process.argv);
    }

    _stop() {
        this.commander.command('stop')
        .action(()=>{
            require('./lib/stop').stop();
        });
    }

    _reload() {
        this.commander.command('reload')
        .action(()=>{
            require('./lib/reload').reload();
        });
    }

    _startOrReload() {
        this.commander.command('startOrReload')
        .action(async () => {

        });
    }
}