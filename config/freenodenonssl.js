var config = {};
config.pagination = {};
config.server = {};
config.storage = {};
config.storage.file = {};
config.storage.mongo = {};

// Number of lines per page.
config.pagination.pagecount = 50;
config.pagination.navGrain = 5;


// IRC Server
config.server.server = 'banks.freenode.net';
config.server.user = 'snail';
config.server.pass = '';
config.server.port = 6666;
config.server.channels = [
    '#ubuntu',
    '#ubuntu-server',
    '#haskell',
    '#racket',
    '#clojure',
    '#programming',
    '#git',
    '#proglangdesign'];
config.server.secure = false;
config.server.verifyssl = true;
config.server.selfsigned = false;
config.server.debug = true;
config.server.recontimout = 120000;

// File storage
config.storage.file.dir = 'logs';
config.storage.mongo.addr = 'mongodb://localhost:27017/irclogsdev';


module.exports = config;