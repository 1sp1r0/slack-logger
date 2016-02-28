var config = {};
config.pagination = {};
config.server = {};
config.slack = {};
config.storage = {};
config.storage.file = {};
config.storage.mongo = {};

// Number of lines per page.
config.pagination.pagecount = 50;
config.pagination.navGrain = 5;


// Slack stuff.
config.slack.token = 'xoxp-46531...-22529234322-901012613c';

// File storage
config.storage.file.files = 'shared_files';
config.storage.file.logs = 'logs';
config.storage.mongo.addr = 'mongodb://localhost:27017/irclogsdev';


module.exports = config;