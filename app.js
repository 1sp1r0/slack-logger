var winston = require('winston');
var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var fs = require('fs');
var path = require('path');
var request = require('request');
request.debug = false;
var slackhelp = require('./lib/slack-api.js');
var log = require('./lib/logging.js');
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
 * Given a message, logs this to mongo.
 * @param channel The channel of the message.
 * @param message Actual text of message.
 * @param sender Sender of the message.
 * @param timestamp When the message arrived.
 * @param filename The name of the file according to Slack.
 */
function storeLineInDb(channel, message, sender, timestamp, filename) {
    var chan = channel.replace('#', '');

    mongodb.connect(cfg.storage.mongo.addr, function (err, db) {
        if (!err) {
            var collection = db.collection(channel);
            var record = {
                channel: chan,
                message: message,
                sender: sender,
                timestamp: timestamp,
                file: filename // Null most of the time. Only if the message contained a file.
            };
            collection.insertOne(record, function (err, results) {
                if (err) {
                    console.error('Error storing line in database: ' + err);
                }
            });
        } else {
            log.error('Error connecting to mongodb: ' + err);
        }

    });
}

/**
 * Stores a simple message in the database.
 * @param channel The channel of the message.
 * @param message Actual text of message.
 * @param sender Sender of the message.
 * @param timestamp When the message arrived.
 */
function storeMessageDb(channel, message, sender, timestamp) {
    storeLineInDb(channel, message, sender, timestamp, null);
}

/**
 * Stores a message line in the database along with the filename.
 * @param channel The channel of the message.
 * @param sender Sender of the message.
 * @param timestamp When the message arrived.
 */
function storeFileDb(channel, sender, filename, timestamp) {
    storeLineInDb(channel, null, sender, timestamp, filename);
}

/**
 * Downloads a given file from the web and stores in the mongodb.
 * @param url Url of the file to download.
 * @param filename Filename that was given.
 * @param cb Callback.
 */
function downloadFromWeb(url, filename, cb) {
    // Construct a unique filename to store this file on disk.
    var identifier = new ObjectID().toString();
    var uniqueName = identifier + filename;
    var targetFile = cfg.storage.file.files + '/' + uniqueName;

    slackhelp.snatchFileTo(cfg.slack.token, url, targetFile,
        function (err) {
            if (!err) {
                mongodb.connect(cfg.storage.mongo.addr, function (err, db) {
                    var coll = db.collection('files');
                    var record = {
                        original: filename,
                        identifier: identifier,
                        uniqueName: uniqueName
                    };
                    coll.insertOne(record, function (err, res) {
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
    log.trace(JSON.stringify(message, null, 2));
    if (!message.subtype) {
        var messageText = message.text;
        var timestamp = currentmillis();

        slackhelp.userDetails(token, message.user, function (err, user) {
            slackhelp.channelDetails(token, message.channel, function (err, chan) {
                var channel = null;
                if (chan.group) {
                    channel = chan.group.name;
                }
                else if (chan.channel) {
                    channel = chan.channel.name;
                }
                storeMessageDb(channel, messageText, user.user.name, timestamp);
            });
        });
    }
});

/**
 * Listens for uploaded files. Stores them on disk, add custom entry in the log file.
 */
rtm.on(RTM_EVENTS.FILE_SHARED, function (message) {
    log.trace(JSON.stringify(message, null, 2));
    var timestamp = currentmillis();
    var sender = message.file.user;
    var channel = message.file.channels[0];
    var filename = message.file.name;
    var downloadUrl = message.file['url_private'];

    downloadFromWeb(downloadUrl, filename, function (err, uniqueName) {
        if (err) {
            log.error('Error downloading file from Slack: ' + err);
        }
        else {
            slackhelp.userDetails(token, sender, function (err, user) {
                slackhelp.channelDetails(token, channel, function (err, chan) {
                    var channel = null;
                    if (chan.group) {
                        channel = chan.group.name;
                    }
                    else if (chan.channel) {
                        channel = chan.channel.name;
                    }
                    storeFileDb(channel, user.user.name, uniqueName, timestamp);
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
var fileRouter = require('./src/routes/fileRoutes')();

app.use('/channel', channelRouter);
app.use('/files', fileRouter);

// Local Routes
app.get('/', function (req, res) {
    log.trace('GET: /');
    res.redirect('/channel');
});

app.listen(port, function (err) {
    log.trace('Running: http://localhost:' + port + '/');
});