const Logger = require('zlogger');

const logger = new Logger({
    prefix: '[egg-cluster-script] ',
    time: true,
});
module.exports = logger;
