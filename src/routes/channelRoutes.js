var express = require('express');
var channelRouter = express.Router();
var mongodb = require('mongodb').MongoClient;
var objectId = require('mongodb').ObjectID;
var moment = require('moment');

// Load the config.
var cfgloc = process.env.CFG || 'bliep';
var cfg = require('../../config/' + cfgloc);
console.log('Running with config: ' + cfgloc);

function getEntries(coll, page, cb) {
    // Create pagination interval.
    var lines = cfg.pagination.pagecount;
    var skip = lines * (page - 1);

    // Fetch the lines for this particular page.
    mongodb.connect(cfg.storage.mongo.addr,
        function (err, db) {
            var dbcoll = db.collection(coll);

            // Count the records.
            dbcoll.count(function (err, total) {
                var pages = Math.ceil(total / cfg.pagination.pagecount);

                // Get the page contents.
                db.collection(coll)
                    .find()
                    .skip(skip)
                    .limit(lines)
                    .toArray(function (err, res) {
                        cb({
                            lines: res,
                            totalPages: pages
                        });
                    });
            });

        });
}

function searchEntries(coll, regex, query, cb) {
    mongodb.connect(cfg.storage.mongo.addr,
        function (err, db) {
            var dbcoll = db.collection(coll);

            var queryparam = new RegExp('.*' + query + '.*');
            if (regex) {
                queryparam = new RegExp(query);
            }

            // Get the page contents.
            db.collection(coll)
                .find({'message': queryparam})
                .toArray(function (err, res) {
                    cb({
                        lines: res
                    });
                });
        });
}

function linecountsPerUser(coll, cb) {
    mongodb.connect(cfg.storage.mongo.addr,
        function (err, db) {
            var dbcoll = db.collection(coll);

            // Get the page contents.
            db.collection(coll)
                .aggregate({$group: {_id: '$sender', count: {$sum: 1}}},
                    cb);
        });
}

function linesPerday(coll, cb) {
    mongodb.connect(cfg.storage.mongo.addr,
        function (err, db) {
            var dbcoll = db.collection(coll);

            // Get the page contents.
            db.collection(coll)
                .aggregate([
                    {
                        '$project': {
                            'timestamp': {
                                '$add': [new Date(0), '$timestamp']
                            },
                            'linecount': 1
                        }
                    },
                    {
                        '$project': {
                            'year': {'$year': '$timestamp'},
                            'month': {'$month': '$timestamp'},
                            'day': {'$dayOfMonth': '$timestamp'},
                            'linecount': 1,
                            'timestamp': 1
                        }
                    },
                    {
                        '$group': {
                            '_id': {
                                'timestamp_year': '$year',
                                'timestamp_month': '$month',
                                'timestamp_day': '$day',
                                'linecount': '$linecount'
                            },
                            'total': {'$sum': 1}
                        }
                    }
                ], cb);
        });
}

var router = function (nav) {
    channelRouter.route('/')
        .get(function (req, res) {
            console.log('GET: /channel/');
            console.log('get channels');
            mongodb.connect(cfg.storage.mongo.addr,
                function (err, db) {
                    db.listCollections({name: {$ne: 'system.indexes'}}).toArray(function (err, cols) {
                        var channels = cols.filter(function (collection) {
                            return !(collection.name == 'system.indexes' ||
                            collection.name == 'files')
                        });
                        res.render('index',
                            {
                                title: 'Render',
                                channels: channels,
                                nav: nav
                            });
                    });
                });
        });
    channelRouter.route('/:chan/:page(\\d+)?')
        .get(function (req, res) {
            console.log('GET: /channel/:chan/:page?');
            var id = req.params.chan;
            var page = parseInt(req.params.page);
            if (!page) {
                page = 1;
            }
            linecountsPerUser(id, function (err, res) {
                //console.log(res);
            });
            linesPerday(id, function (err, res) {
                console.log(res);
            });
            getEntries(id, page, function (results) {
                res.render('channel', {
                    moment: moment,
                    messages: results.lines,
                    lastPage: results.totalPages,
                    navGrain: cfg.pagination.navGrain,
                    currentPage: page,
                    nav: nav
                });
            });

        });

    channelRouter.route('/:chan/:page(\\d+)?')
        .post(function (req, res) {
            console.log('POST: /:chan/:page?');
            // Parse post variables.
            var query = req.body.query;
            var regex = false;
            if (req.body.regex) {
                regex = true;
            }
            console.log(query + ' ' + regex);

            // Parse url parameters.
            var channel = req.params.chan;
            var page = parseInt(req.params.page);
            if (!page) {
                page = 1;
            }

            // Do the search.
            searchEntries(channel, regex, query, function (results) {
                res.render('channel', {
                    moment: moment,
                    messages: results.lines,
                    lastPage: 1,
                    navGrain: cfg.pagination.navGrain,
                    currentPage: 1,
                    nav: nav
                });
            });
        });
    return channelRouter;
};

module.exports = router;