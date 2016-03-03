var chalk = require('chalk');
var util = require('util');

var cfgloc = process.env.CFG || '';
var cfg = require('../config/' + cfgloc);

var debug = cfg.debug;

module.exports = {
    error: function (str) {
        if(debug)
        {
            console.log(chalk.red(str));
        }
    },
    debug: function(str) {
        if(debug)
        {
            console.log(chalk.green(str));
        }
    },
    trace: function(str) {
        if(debug)
        {
            console.log(chalk.yellow(str));
        }
    }
};