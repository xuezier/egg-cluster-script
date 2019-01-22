#!/usr/bin/env node

'use strict';

const cluster = require('cluster');
const events = require('events');

const ipc = require('node-ipc');
const fs = require('mz/fs');
const sleep = require('mz-modules/sleep');

const helper = require('../lib/helper');

const cacheDir = helper.cacheDir;

const emitter = new events.EventEmitter();
let workerQueue = [];

emitter.on('run', async () => {
    const worker = workerQueue.shift();
    if(!worker || emitter.isRunning === true) {
        return;
    }

    const pid = worker.pid;

    const file = `${cacheDir}/.worker_${pid}`;

    if(worker.method === 'fork') {
        await fs.writeFile(file, pid);
    }
    else {
        await fs.unlink(file);
    }
    emitter.emit('run');
});

let workersNum;
if(cluster.isMaster) {
    const options = JSON.parse(process.argv[2]);
    workersNum = options.workers || 1;
    require(options.framework).startCluster(options);


    cluster.on('fork', async worker => {
        workerQueue.push({
            method: 'fork',
            pid: String(worker.process.pid)
        });

        emitter.emit('run');
    });

    cluster.on('exit', async worker => {
        workerQueue.push({
            method: 'exit',
            pid: String(worker.process.pid)
        });
        emitter.emit('run');
    });

    ipc.config.id = 'egg-worker-unique-process';
    ipc.config.retry = 1500;
    ipc.config.silent = true;
    ipc.serve(() => ipc.server.on('egg-worker-unique-message', async pid => {
        const workers = cluster.workers;
        for(let id in workers) {
            const worker = workers[id];
            if(worker.process.pid === +pid) {
                worker.kill();
                process.env.EGG_SERVER_ENV === 'prod' || cluster.fork();
            }
        }
    }));
    ipc.server.start();
    process.on('exit', () => {
        ipc.server.stop();
    });
}