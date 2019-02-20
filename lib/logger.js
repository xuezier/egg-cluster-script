const Logger = require('zlogger');

const logger = new Logger({
    prefix: '[egg-cluster-script] ',
    time: false,
});
module.exports = logger;
