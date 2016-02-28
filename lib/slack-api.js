var chalk = require('chalk');
var request = require('request');
var fs = require('fs');
var util = require('util');

function apiCall(method, args, cb) {
    var slackurl = 'https://slack.com/api/' + method;

    function callback(error, response, body) {
        if (!error && response.statusCode == 200) {
            var info = JSON.parse(body);
            if (info.ok) {
                cb(null, info);
            }
            else {
                console.log('Api call error: ' + info.error);
                cb(info.error, null);
            }
        }
    }

    request({url: slackurl, qs: args}, callback);
}


module.exports = {
    /**
     * Function that, given a user id (e.g., UADDF23), will resolve the actual username of the user using the Slack api.
     * @param token
     * @param id
     * @param cb
     */
    userDetails: function (token, id, cb) {
        console.log('API CALL :: user => ' + id);
        var pars = {
            token: token,
            user: id
        };
        apiCall('users.info', pars, cb);
    },
    /**
     * Function that, given the group id will resolve the actual channel name using the Slack api.
     * @param token
     * @param id
     * @param cb
     */
    channelDetails: function (token, id, cb) {
        console.log('API CALL :: channel => ' + id);
        var pars = {
            token: token,
            channel: id
        };

        var errorhandler = function (error, result) {
            if (error) {
                apiCall('groups.info', pars, cb);
            }
            else {
                cb(null, result);
            }
        };

        apiCall('channels.info', pars, errorhandler);
    },
    /**
     * Same as channelDetails, except for groups.
     * @param token
     * @param id
     * @param cb
     */
    groupDetails: function (token, id, cb) {
        console.log('API CALL :: group => ' + id);
        var pars = {
            token: token,
            channel: id
        };
        apiCall('groups.info', pars, cb);
    },
    /**
     * Downloads the file from the url into the given filename (must be a path!).
     * @param token
     * @param weburl url to download
     * @param filename filename to be given to this file.
     * @param cb callback.
     */
    snatchFileTo: function (token, weburl, filename, cb) {
        console.log(chalk.red(util.format('API CALL :: download file => %s', weburl)));
        request
            .get({
                followAllRedirects: true,
                url: weburl,
                headers: {
                    'Authorization': 'Bearer ' + token
                }
            })
            .on('error', function (err) {
                console.log(chalk.red('Error during download of attachment ' + filename));
                fs.unlink(dest); // Delete the file async. (But we don't check the result)
                if (cb) {
                    cb(err.message);
                }
            })
            .on('complete', function () {
                console.log(chalk.green(util.format('Downloading of %s completed', filename)));
                cb(null);
            })
            .pipe(fs.createWriteStream(filename));
    }
};