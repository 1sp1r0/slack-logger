var winston = require('winston');
var mongodb = require('mongodb').MongoClient;
var objectId = require('mongodb').ObjectID;
var fs = require('fs');
var path = require('path');
var request = require('request');
request.debug = false;
var slackhelp = require('./lib/slack-api.js');
var util = require('util');
var chalk = require('chalk');

// For Web app
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var passport = require('passport');
var session = require('express-session');
var app = express();

// Load the config.
var cfgloc = process.env.CFG || 'bliep';
var cfg = require('./config/' + cfgloc);
console.log('Running with config: ' + cfgloc);

////////////////////////////////////////////////////////////////////////////////
// HELPERS

function currentmillis() {
    return new Date().getTime();
}

////////////////////////////////////////////////////////////////////////////////
// STORAGE

/**
 * Given a message, logs this to a file.
 * @param channel The channel of the message
 * @param message Actual text of message
 * @param sender Sender of the message
 * @param timestamp When the message arrived
 */
function storeFile(channel, message, sender, timestamp) {
    var chan = channel.replace('#', '');

    var line = timestamp + ' ; ' + chan + ' ; ' + sender + ' ; ' + message;
    var file = path.join(cfg.storage.file.logs, chan + '.csv');
    console.log(file);

    fs.appendFile(file, line + '\n', 'utf8', function (err) {
        if (err) {
            console.error('Error writing to file: ' + err);
        }
    });
}

/**
 * Given a message, logs this to mongo.
 * @param channel The channel of the message
 * @param message Actual text of message
 * @param sender Sender of the message
 * @param timestamp When the message arrived
 */
function storeDb(channel, message, sender, timestamp, filename) {
    var chan = channel.replace('#', '');
    mongodb.connect(cfg.storage.mongo.addr, function (err, db) {
        var collection = db.collection(channel);
        var record = {
            channel: chan,
            message: message,
            sender: sender,
            timestamp: timestamp,
            file: filename
        };
        collection.insertOne(record, function (err, results) {
            if (err) {
                console.error('Error storing in Mongo: ' + err);
            }
        });
    });
}

function storeMessageDb(channel, message, sender, timestamp) {
    storeDb(channel, message, sender, timestamp, null);
}

function storeFileDb(channel, sender, filename, timestamp) {
    storeDb(channel, 'file: ', sender, timestamp, filename);
}

/**
 * Downloads a given file from the web and stores in the mongodb.
 * @param url Url of the file to download
 * @param filename Filename that was given.
 * @param cb callback
 */
function downloadFromWeb(url, filename, cb) {
    // Generate a unique name for this file.
    var identifier = new objectId().toString(); // unique identifier.
    var uniqueName = identifier + filename;
    // Compute where the file should be written to.
    var target = cfg.storage.file.files + '/' + uniqueName;

    slackhelp.snatchFileTo(cfg.slack.token, url, target,
        function (err) {
            if (!err) {
                mongodb.connect(cfg.storage.mongo.addr, function (err, db) {
                    var collection = db.collection('files');
                    var record = {
                        original: filename,
                        identifier: identifier,
                        uniqueName: uniqueName
                    };
                    collection.insertOne(record, function (err, res) {
                        if (err) {
                            console.error('Error storing in Mongo: ' + err);
                        }
                        else {
                            cb(null, uniqueName);
                        }
                    });
                });
            }
        });
}

////////////////////////////////////////////////////////////////////////////////
/// CONNECT

var RtmClient = require('slack-client').RtmClient;
var RTM_EVENTS = require('slack-client').RTM_EVENTS;
var token = cfg.slack.token || '';
//var rtm = new RtmClient(token, {logLevel: 'debug'});
var rtm = new RtmClient(token);

rtm.start();

/**
 * Listens to all messages. We use this handler to register regular chat messages.
 * So we ignore subtypes. For each subtype create a seperate handler.
 */
rtm.on(RTM_EVENTS.MESSAGE, function (message) {
    if (!message.subtype) {
        console.log(chalk.green('MESSAGE'));

        var msg = message.text;
        var when = currentmillis();

        slackhelp.userDetails(token, message.user, function (err, user) {
            slackhelp.channelDetails(token, message.channel, function (err, chan) {
                var channel = null;
                if (chan.group) {
                    channel = chan.group.name;
                }
                else if (chan.channel) {
                    channel = chan.channel.name;
                }
                storeMessageDb(channel, msg, user.user.name, when);
            });
        });
    }
});

/**
 * Listens for uploaded files. Stores them on disk, add custom entry in the log file.
 */
rtm.on(RTM_EVENTS.FILE_SHARED, function (message) {
    console.log(chalk.green('FILE SHARED'));

    var when = currentmillis();
    var sender = message.file.user;
    var channel = message.file.channels[0];
    var filename = message.file.name;
    var downloadUrl = message.file['url_private'];

    downloadFromWeb(downloadUrl, filename, function (err, uniqueName) {
        if (err) {
            console.log(chalk.red(err));
        }
        else {
            console.log('FILE: ' + sender + ' ' + channel);
            slackhelp.userDetails(token, sender, function (err, user) {
                slackhelp.channelDetails(token, channel, function (err, chan) {
                    var channel = null;
                    if (chan.group) {
                        channel = chan.group.name;
                    }
                    else if (chan.channel) {
                        channel = chan.channel.name;
                    }
                    storeFileDb(channel, user.user.name, uniqueName, when);
                });
            });
        }

    });

});

////////////////////////////////////////////////////////////////////////////////
/// WEBAPP

var port = process.env.PORT || 5000;
var nav =
    [
        {link: '/channel', text: 'Channels'},
        {link: '/', text: 'Home'}
    ];

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(session({secret: 'library'}));
var basicAuth = require('basic-auth-connect');
app.use(basicAuth('username', 'password'));
// Views
app.set('views', './src/views');
app.set('view engine', 'ejs');

// Routes
var channelRouter = require('./src/routes/channelRoutes')(nav);
app.use('/channel', channelRouter);
var fileRouter = require('./src/routes/fileRoutes')();
app.use('/files', fileRouter);

// Routes
app.get('/', function (req, res) {
    console.log('GET: /');
    res.redirect('/channel');
});

app.listen(port, function (err) {
    console.log('Running: http://localhost:' + port + '/');
});