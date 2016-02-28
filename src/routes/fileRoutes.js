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
            var uniqueName = req.params.uniqueName;
            mongodb.connect(cfg.storage.mongo.addr,
                function (err, db) {
                    var coll = db.collection('files');
                    coll.findOne({uniqueName: uniqueName},
                        function (err, results) {
                            if(!err) {
                                res.sendFile(uniqueName, {root: cfg.storage.file.files});
                            }
                            else {
                                console.log('Error retrieving file data from database: ' + uniqueName);
                            }
                        });
                });
        });
    return fileRouter;
};

module.exports = router;