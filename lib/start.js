const spawn = require('child_process').spawn;
const path  = require('path');

const mkdirp = require('mz-modules/mkdirp');
const sleep = require('mz-modules/sleep');
const fs = require('mz/fs');
const { execFile } = require('mz/child_process');

const moment = require('moment');
const homedir = require('node-homedir');

const logger = require('./logger');
const helper = require('./helper');

let isReady = true;

exports.start = async function({
    command,
    isDaemon,
    title = 'egg-application',
    instances = 1,
    baseDir,
    logDir,
    port,
    ignoreStdErr,
    framework = 'egg'
} = {}) {
    const pkg = require(path.join(baseDir || process.cwd(), 'package.json'));
    const egg = pkg.egg;

    title = title || `egg-server-${pkg.name}`;
    framework = (egg && egg.framework) || framework || 'egg';

    const HOME = homedir();
    logDir = logDir || helper.logDir;
    const cacheDir = helper.cacheDir;
    await mkdirp(cacheDir);
    (await fs.exists(`${cacheDir}/.worker_pids`)) && (await fs.unlink(`${cacheDir}/.worker_pids`));

    const env = {};

    env.HOME = HOME;
    env.NODE_ENV = 'production';

    // it makes env big but more robust
    env.PATH = env.Path = [
      // for nodeinstall
      path.join(baseDir, 'node_modules/.bin'),
      // support `.node/bin`, due to npm5 will remove `node_modules/.bin`
      path.join(baseDir, '.node/bin'),
      // adjust env for win
      env.PATH || env.Path,
      // 加入全局的 PATH
      process.env.PATH // 翻车在这里、
    ].filter(x => !!x).join(path.delimiter);

    env.ENABLE_NODE_LOG = 'YES';
    env.NODE_LOG_DIR = env.NODE_LOG_DIR || path.join(logDir, 'alinode');
    await mkdirp(env.NODE_LOG_DIR);

    // env.EGG_SERVER_ENV = process.env.EGG_SERVER_ENV;

    const stdoutPath = path.join(logDir, 'master-stdout.log');
    const stderrPath = path.join(logDir, 'master-stderr.log');
    const serverBin = path.join(__dirname, '../bin/start-cluster');
    const clusterOptions = stringify({
        workers: instances,
        baseDir,
        port,
        title,
        framework
    });

    const eggArgs = [ serverBin, clusterOptions, `--title="${title}"` ];

    if (isDaemon) {
        logger.info(`Save log file to ${logDir}`);
        const [ stdout, stderr ] = [ await getRotatelog(stdoutPath), await getRotatelog(stderrPath) ];

        const options = {
            env,
            stdio: [ 'ignore', stdout, stderr, 'ipc' ],
            detached: true,
        }

        logger.info('Run node %s', eggArgs.join(' '));
        const child = spawn(command, eggArgs, options);
        isReady = false;
        child.on('message', msg => {
          /* istanbul ignore else */
          if (msg && msg.action === 'egg-ready') {
            isReady = true;
            logger.info('%s started on %s', framework, msg.data.address);
            child.unref();
            child.disconnect();
            process.exit(0);
          }
        });

        // // check start status
        await checkStatus({
            child,
            stderr: stdoutPath,
            timeout: 300 * 1000,
            'ignore-stderr': ignoreStdErr
        });

        logger.info('egg started');
    }
    else {
        const options = {
            env,
            stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
            detached: true,
        }

        // logger.debug('Run spawn `%s %s`', command, eggArgs.join(' '));
        const child = spawn(command, eggArgs, options);
        child.once('exit', code => {
            if (code !== 0) {
            child.emit('error', new Error(`spawn ${command} ${eggArgs.join(' ')} fail, exit code: ${code}`));
            }
        });

        // attach master signal to child
        let signal;
        [ 'SIGINT', 'SIGQUIT', 'SIGTERM' ].forEach(event => {
            logger.info(event);
            process.on(event, async() => {
              signal = event;
              process.exit(0);
            });
        });
        process.once('exit', () => {
            // logger.debug('Kill child %s with %s', child.pid, signal);
            child.kill(signal);
        });
    }
}

async function getRotatelog(logfile) {
    await mkdirp(path.dirname(logfile));

    if (await fs.exists(logfile)) {
      // format style: .20150602.193100
      const timestamp = moment().format('.YYYYMMDD.HHmmss');
      // Note: rename last log to next start time, not when last log file created
      await fs.rename(logfile, logfile + timestamp);
    }

    return await fs.open(logfile, 'a');
  }

  function stringify(obj, ignore = []) {
    const result = {};
    Object.keys(obj).forEach(key => {
      if (!ignore.includes(key)) {
        result[key] = obj[key];
      }
    });
    return JSON.stringify(result);
  }

  async function checkStatus({ stderr, timeout, 'ignore-stderr': ignoreStdErr, child }) {
    let count = 0;
    let hasError = false;
    let isSuccess = true;
    timeout = timeout / 1000;
    while (!this.isReady) {
      try {
        const stat = await fs.stat(stderr);
        if (stat && stat.size > 0) {
          hasError = true;
          break;
        }
      } catch (_) {
        // nothing
      }

      if (count >= timeout) {
        logger.error('Start failed, %ds timeout', timeout);
        isSuccess = false;
        break;
      }

      await sleep(1000);
      logger.log('Wait Start: %d...', ++count);
    }

    if (hasError) {
      try {
        const args = [ '-n', '100', stderr ];
        logger.error('tail %s', args.join(' '));
        const [ stdout ] = await execFile('tail', args);
        logger.error('Got error when startup: ');
      } catch (err) {
        logger.error('ignore tail error: %s', err);
      }

      isSuccess = ignoreStdErr;
      logger.error('Start got error, see %s', stderr);
      logger.error('Or use `--ignore-stderr` to ignore stderr at startup.');
    }

    if (!isSuccess) {
      child.kill('SIGTERM');
      await sleep(1000);
      process.exit(1);
    }
  }
