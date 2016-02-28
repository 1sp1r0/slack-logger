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
config.server.server = 'ip';
config.server.user = 'nick';
config.server.pass = 'pass';
config.server.port = 6697;
config.server.channels =
    [
        '#programming'
    ];
config.server.secure = true;
config.server.verifyssl = false;
config.server.selfsigned = true;
config.server.debug = false;
config.server.recontimout = 120000;

// File storage
config.storage.file.dir = 'logs';
config.storage.mongo.addr = 'mongodb://localhost:27017/irclogsdev';


module.exports = config;