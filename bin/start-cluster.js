#!/usr/bin/env node

'use strict';

const cluster = require('cluster');
const events = require('events');

const ipc = require('node-ipc');
const fs = require('mz/fs');

if(cluster.isMaster) {

    const options = JSON.parse(process.argv[2]);
    require('egg').startCluster(options);

    ipc.config.id = 'egg-worker-unique-process';
    ipc.config.retry = 1500;
    ipc.config.silent = true;
    ipc.serve(() => ipc.server.on('egg-worker-unique-message', async pid => {
        const workers = cluster.workers;
        for(let id in workers) {
            const worker = workers[id];
            if(worker.process.pid === +pid) {
                worker.kill(); // cfork出来的app-worker，会在终止后，重新fork
                // process.kill(pid, 'SIGTERM')
                // process.env.EGG_SERVER_ENV === 'prod' || cluster.fork();
            }
        }
    }));
    ipc.server.start();
    process.on('exit', () => {
        ipc.server.stop();
    });
}
