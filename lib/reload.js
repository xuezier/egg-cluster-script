const fs = require('mz/fs');
const sleep = require('mz-modules/sleep');
const ipc = require('node-ipc');

const helper = require('./helper');
const logger = require('./logger');

exports.reload = async function reload({
    title
} = {}) {
    logger.info(`reloading egg application ${title ? `with --title=${title}` : ''}`);

    let processList = await helper.findNodeProcess(item => {
        const cmd = item.cmd;
        return title ?
            cmd.includes('start-cluster') && cmd.includes(util.format(osRelated.titleTemplate, title)) :
            cmd.includes('start-cluster');
    });

    let pids = processList.map(x => x.pid);

    const cacheDir = helper.cacheDir;
    const masterPid = (await fs.readFile(`${cacheDir}/.master_pid`)).toString();
    if(pids.includes(masterPid)) {
        const workers = (await fs.readdir(`${cacheDir}`)).filter(file => file.startsWith('.worker_'))
        .map(file => file.replace('.worker_', ''));
        if(workers.length) {

            ipc.config.id = 'a-unique-process-2';
            ipc.config.retry = 1500;
            ipc.config.silent = true;

            await new Promise(resolve => {
                ipc.connectTo('egg-worker-unique-process', async () => {
                    for(let pid of workers) {
                        await new Promise(async resolve => {
                            ipc.of['egg-worker-unique-process'].emit('egg-worker-unique-message', pid);
                            await sleep(5000);
                            // 为了防止 worker kill过快导致进程完全无法访问，每个进程间隔延迟5s
                            resolve();
                        });
                    }
                    resolve();
                });
            });
        }
    }
    logger.info('reloaded');
    process.exit(0);
}