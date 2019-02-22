const util = require('util');

const helper = require('./lib/helper');
const logger = require('./lib/logger');

module.exports = class Command {
    constructor() {
        this.helper = require('./lib/helper');

        const env = process.env;
        const { PORT, INSTANCES } = env;

        this.poc_argvs = {
            command: process.execPath || 'node',
            baseDir: process.cwd(),                 // 运行目录
            instances: +INSTANCES || require('os').cpus().length,             // worker数量
            // port: +PORT || 7001,                    // 启动端口
            framework: 'egg',
            title: '',
            isDaemon: false,                  // 守护进程模式
            logDir: null,
            ignoreStdErr: false
        };

        this.commander = null;
    }

    async start() {
        this.commander = require('./lib/commander');

        this._stop();
        this._reload();
        this._startOrReload();
        this._start();

        this.commander.parse(process.argv);
    }

    setInstances(command) {
        command.option('-i, --instances <n>', 'max workers num of cluster mode', (num = 1) => {
            const instances = +num;
            if(isNaN(instances) || instances <= 0) {
                instances = 1;
            }
            this.poc_argvs.instances = instances;
        });

        return this;
    }

    setPort(command) {
        command.option('-p, --port <n>', 'set egg app listening port', (port = 7001) => {
            this.poc_argvs.port = +port;
        });

        return this;
    }

    setTitle(command) {
        command.option('-t, --title <t>', 'set application title', title => {
            this.poc_argvs.title = title;
        });

        return this;
    }

    setIsDaemon(command) {
        command.option('-d, --daemon', 'open daemon', () => {
            this.poc_argvs.isDaemon = true;
        });

        return this;
    }

    setLogDir(command) {
        command.option('-l, --logdir <d>', 'log dir', dir => {
            this.poc_argvs.logDir = dir;
        });

        return this;
    }

    setBaseDir(command) {
        command.option('-b, --basedir <d>', 'set egg application base dir', dir => {
            this.poc_argvs.baseDir = dir;
        });

        return this;
    }

    setIgnoreStdErr(command) {
        command.option('-ig, --ignore-stderr', 'ignore std err', () => {
            this.poc_argvs.ignoreStdErr = true;
        });

        return this;
    }

    _start() {
        const command = this.commander.command('start');

        this.setInstances(command)
        .setPort(command)
        .setTitle(command)
        .setIsDaemon(command)
        .setLogDir(command)
        .setIgnoreStdErr(command)
        .setBaseDir(command);

        command.action(async () => {
            await require('./lib/stop').stop(this.poc_argvs);
            await require('./lib/start').start(this.poc_argvs);
        })
    }

    _stop() {
        const command = this.commander.command('stop');

        this.setTitle(command);

        command.action(()=>{
            require('./lib/stop').stop(this.poc_argvs);
        });
    }

    _reload() {
        const command = this.commander.command('reload');

        this.setTitle(command);

        command.action(()=>{
            require('./lib/reload').reload(this.poc_argvs);
        });
    }

    _startOrReload() {
        const command = this.commander.command('startOrReload');

        this.setInstances(command)
        .setPort(command)
        .setTitle(command)
        .setIsDaemon(command)
        .setLogDir(command)
        .setIgnoreStdErr(command)
        .setBaseDir(command);

        command.action(async () => {
            const argvs = this.poc_argvs;

            const { title } = argvs;

            if(!title) {
                logger.error('title option is required');
                process.exit(1);
            }

            const processList = await helper.findNodeProcess(item => {
                const cmd = item.cmd;
                return title ?
                    cmd.includes('start-cluster') && cmd.includes(util.format(helper.osRelated.titleTemplate, title)) :
                    cmd.includes('start-cluster');
            });
            let pids = processList.map(x => x.pid);
            if(pids.length) {
                logger.info('reload egg app: %s', title);
                await require('./lib/reload').reload(argvs);
            }
            else {
                logger.info('start egg app: %s', title);
                await require('./lib/start').start(argvs);
                logger.info(`[${title}] success started`);
            }
        });
    }
}