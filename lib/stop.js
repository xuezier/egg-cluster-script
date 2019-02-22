const util = require('util');
const sleep = require('mz-modules/sleep');

const helper = require('./helper');
const logger = require('./logger');

const isWin = process.platform === 'win32';
const osRelated = {
  titleTemplate: isWin ? '\\"title\\":\\"%s\\"' : '--title="%s"',
  appWorkerPath: isWin ? 'egg-cluster\\lib\\app_worker.js' : 'egg-cluster/lib/app_worker.js',
  agentWorkerPath: isWin ? 'egg-cluster\\lib\\agent_worker.js' : 'egg-cluster/lib/agent_worker.js',
};

exports.stop = async function stop({
    title
} = {}) {
    logger.info(`stopping egg application ${title ? `with --title=${title}` : ''}`);

    let processList = await helper.findNodeProcess(item => {
        const cmd = item.cmd;
        return title ?
            cmd.includes('start-cluster') && cmd.includes(util.format(osRelated.titleTemplate, title)) :
            cmd.includes('start-cluster');
    });
    let pids = processList.map(x => x.pid);
    if (pids.length) {
        logger.info('got master pid %j', pids);
        helper.kill(pids);
        // wait for 5s to confirm whether any worker process did not kill by master
        await sleep('5s');
    } else {
        logger.warn('can\'t detect any running egg process');
    }

    processList = await helper.findNodeProcess(item => {
        const cmd = item.cmd;
        return title ?
          (cmd.includes(osRelated.appWorkerPath) || cmd.includes(osRelated.agentWorkerPath)) && cmd.includes(util.format(osRelated.titleTemplate, title)) :
          (cmd.includes(osRelated.appWorkerPath) || cmd.includes(osRelated.agentWorkerPath));
    });
    pids = processList.map(x => x.pid);
    if (pids.length) {
        logger.info('got worker/agent pids %j that is not killed by master', pids);
        helper.kill(pids, 'SIGKILL');
    }

    logger.info('stopped');
}