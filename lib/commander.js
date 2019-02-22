var program = require('commander');
const pkg = require('../package.json');
const commander = program.version(pkg.version);

module.exports = commander;
