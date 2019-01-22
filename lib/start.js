const spawn = require('child_process').spawn;
const path  = require('path');

const mkdirp = require('mz-modules/mkdirp');
const sleep = require('mz-modules/sleep');
const fs = require('mz/fs');
const { execFile } = require('mz/child_process');

const moment = require('moment');

const logger = require('./logger');
const helper = require('./helper');

let isReady = true;

exports.start = async function({
    command,
    isDaemon = false,
    title = 'egg-application',
    instances = 1,
    baseDir,
    port,
    framework = 'egg'
} = {}) {
    const HOME = process.env.HOME;

    const logDir = helper.logDir;
    const cacheDir = helper.cacheDir;
    await mkdirp(cacheDir);
    (await fs.exists(`${cacheDir}/.worker_pids`)) && (await fs.unlink(`${cacheDir}/.worker_pids`));

    const stdoutPath = path.join(logDir, 'master-stdout.log');
    const stderrPath = path.join(logDir, 'master-stderr.log');

    const serverBin = path.join(__dirname, '../bin/start-cluster');
    const clusterOptions = stringify({
        workers: instances,
        baseDir,
        port,
        framework
    });

    const eggArgs = [ serverBin, clusterOptions, `--title=${title}` ];

    if (isDaemon) {
        logger.info(`Save log file to ${logDir}`);
        const [ stdout, stderr ] = [ await getRotatelog(stdoutPath), await getRotatelog(stderrPath) ];

        const options = {
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

        const wr = fs.createWriteStream(`${cacheDir}/.master_pid`, {
            encoding: 'utf8'
        });

        wr.on('errpr', logger.error);
        wr.write(String(child.pid));
        wr.end();

        // // check start status
        await checkStatus({
            stderr: stdoutPath,
            timeout: 300 * 1000,
            'ignore-stderr': true
        });
    }
    else {
        const options = {
            stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
            detached: true,
        }

        logger.debug('Run spawn `%s %s`', command, eggArgs.join(' '));
        const child = spawn(command, eggArgs, options);
        child.once('exit', code => {
            if (code !== 0) {
            child.emit('error', new Error(`spawn ${command} ${eggArgs.join(' ')} fail, exit code: ${code}`));
            }
        });

        // attach master signal to child
        let signal;
        [ 'SIGINT', 'SIGQUIT', 'SIGTERM' ].forEach(event => {
            process.once(event, () => {
            signal = event;
            process.exit(0);
            });
        });
        process.once('exit', () => {
            logger.debug('Kill child %s with %s', child.pid, signal);
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

  async function checkStatus({ stderr, timeout, 'ignore-stderr': ignoreStdErr }) {
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
        logger.error(stdout);
      } catch (err) {
        logger.error('ignore tail error: %s', err);
      }

      isSuccess = ignoreStdErr;
      logger.error('Start got error, see %s', stderr);
      logger.error('Or use `--ignore-stderr` to ignore stderr at startup.');
    }

    if (!isSuccess) {
      this.child.kill('SIGTERM');
      await sleep(1000);
      this.exit(1);
    }
  }
