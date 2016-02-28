var express = require('express');
var fileRouter = express.Router();
var mongodb = require('mongodb').MongoClient;

// Load the config.
var cfgloc = process.env.CFG || 'bliep';
var cfg = require('../../config/' + cfgloc);
console.log('Running with config: ' + cfgloc);

var router = function () {
    fileRouter.route('/:uniqueName')
        .get(function (req, res) {
            console.log('GET: /files/');
            var uniqueName = req.params.uniqueName;

            mongodb.connect(cfg.storage.mongo.addr,
                function (err, db) {
                    var dbcoll = db.collection('files');
                    dbcoll.findOne({uniqueName: uniqueName},
                        function (err, results) {
                            console.log(results);
                            res.sendFile(cfg.storage.file.files + '/' + uniqueName);
                        });
                });
        });
    return fileRouter;
};

module.exports = router;