const child_process = require('child_process');
const path = require('path');

const runScript = require('runscript');

const isWin = exports.isWin = process.platform === 'win32';
const REGEX = isWin ? /^(.*)\s+(\d+)\s*$/ : /^\s*(\d+)\s+(.*)/;


const HOME = process.env.HOME;
const logDir = exports.logDir = path.join(HOME, 'logs');
const cacheDir = exports.cacheDir = path.join(logDir, '.cache');

const osRelated = exports.osRelated = {
  titleTemplate: isWin ? '\\"title\\":\\"%s\\"' : '"title":"%s"',
  appWorkerPath: isWin ? 'egg-cluster\\lib\\app_worker.js' : 'egg-cluster/lib/app_worker.js',
  agentWorkerPath: isWin ? 'egg-cluster\\lib\\agent_worker.js' : 'egg-cluster/lib/agent_worker.js',
};

exports.findNodeProcess = async function(filterFn) {
    const command = isWin ?
      'wmic Path win32_process Where "Name = \'node.exe\'" Get CommandLine,ProcessId' :
      // command, cmd are alias of args, not POSIX standard, so we use args
      'ps -eo "pid,args"';
    const stdio = await runScript(command, { stdio: 'pipe' });
    const processList = stdio.stdout.toString().split('\n')
      .reduce((arr, line) => {
        if (!!line && !line.includes('/bin/sh') && line.includes('node')) {
          const m = line.match(REGEX);
          /* istanbul ignore else */
          if (m) {
              const item = isWin ? { pid: m[2], cmd: m[1] } : { pid: m[1], cmd: m[2] };
            if (!filterFn || filterFn(item)) {
              arr.push(item);
            }
          }
        }
        return arr;
      }, []);
    return processList;
};

exports.kill = function(pids, signal) {
    pids.forEach(pid => {
        try {
            process.kill(pid, signal);
        } catch (err) { /* istanbul ignore next */
            if (err.code !== 'ESRCH') {
            throw err;
            }
        }
    });
}

exports.forkNode = function forkNode() {

};
