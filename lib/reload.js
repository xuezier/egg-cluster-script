const util = require('util');

const fs = require('mz/fs');
const sleep = require('mz-modules/sleep');
const ipc = require('node-ipc');

const helper = require('./helper');
const logger = require('./logger');

exports.reload = async function reload({
    title
} = {}) {
    if(!title) {
        logger.warn('will reload all egg app workers');
    }

    logger.info(`reloading egg application ${title ? `with --title=${title}` : ''}`);

    let processList = await helper.findNodeProcess(item => {
        const cmd = item.cmd;
        return title ?
            cmd.includes('start-cluster') && cmd.includes(util.format(helper.osRelated.titleTemplate, title)) :
            cmd.includes('start-cluster');
    });

    let pids = processList.map(x => x.pid);
    logger.info('got master worker pids: ', pids);

    if(pids.length) {
        processList = await helper.findNodeProcess(item => {
            const cmd = item.cmd;
            const osRelated = helper.osRelated;
            return title ?
              (cmd.includes(osRelated.appWorkerPath) || cmd.includes(osRelated.agentWorkerPath)) && cmd.includes(util.format(osRelated.titleTemplate, title)) :
              (cmd.includes(osRelated.appWorkerPath) || cmd.includes(osRelated.agentWorkerPath));
        });
        const workers = processList.map(x => x.pid);
        if(workers.length) {

            ipc.config.id = 'a-unique-process-2' + title;
            ipc.config.retry = 1500;
            ipc.config.silent = true;

            await new Promise(resolve => {
                const serve = 'egg-worker-unique-process' + title;
                ipc.connectTo(serve, async () => {

                    ipc.of[serve].on('connect', async () => {

                        for(let pid of workers) {
                            logger.info(`reloading app-worker: ${pid}`);
                            await new Promise(async resolve => {
                                ipc.of[serve].emit('egg-worker-unique-message', pid);
                                await sleep(5000);
                                // 为了防止 worker kill过快导致进程完全无法访问，每个进程间隔延迟5s
                                resolve();
                            });
                        }
                        resolve(serve);
                        logger.info('reloaded');
                        logger.info(`[${title}]  success restarted`);
                        process.exit(0);
                    });
                });
            });
            ipc.disconnect();
        }
    }

}