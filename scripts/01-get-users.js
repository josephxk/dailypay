/*  joseph kwan
 *  prepare the list of customers and service providers for the day
 */

var fs = require('fs');
var async = require('async');
var _ = require('lodash');
var moment = require('moment');
var mysql = require('mysql');
var knex = require('knex')({
    client: 'mysql',
    connection: {
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'dailypay'//,
        //debug: 'true'
    }
});

var date, outputFile, outputStr;
var collectionSize = 0;
var passCount = 0;
var failCount = 0;
var dupEntryCount = 0;
var _format = 'YYYY-MM-DD HH:mm:ss:SSS';

//get the date parameter e.g 2016-08-17
if (process.argv[2] === undefined) {
    date = moment().format('YYYY-MM-DD');
} else {
    date = process.argv[2];
}

outputFile = './log/01-users-' + date + '.txt';

console.log(moment().format(_format) + ' - 01-get-users - *start*');

async.waterfall([
        //get the users
        function (callback) {
            knex.select('id', 'email')
                .from('users')
                .where({
                    reg_status: 7,
                    active: true
                })
                .then(function (users) {
                    //no error, and pass in the users array
                    console.log(moment().format(_format) + ' - fetched users')
                    callback(null, users);
                })
                .catch(function (err) {
                    outputStr = moment().format(_format) + ' - ' + err.toString() + '\n';
                    console.log(outputStr);
                    fs.appendFile(outputFile, outputStr, function (err) {
                        if (err) throw err;
                        console.log(moment().format(_format) + ' - file ' + outputFile + ' created/appended.');
                    });
                    callback(err);
                });
        },
        function (users, callback) {
            outputStr = '';
            collectionSize = _.size(users);

            async.eachSeries(users, function (user, callback) {
                knex.insert({
                    id: null,
                    user_id: user.id,
                    email: user.email,
                    job_period: date,
                    service: 'uber',
                    counter: 0,
                    processed: 0
                })
                    .into('proc_users')
                    .then(function (row) {
                        //process.stdout.write('.');
                        passCount++;
                        outputStr = 'PASS,' + moment().format(_format) + ',' + row.toString() + '\n';
                        fs.appendFile(outputFile, outputStr, function (err) {
                            if (err) throw err;
                            //console.log('file ' + outputFile + ' created/appended.');
                        });
                        callback(null);
                    })
                    .catch(function (err) {
                        //process.stdout.write('f');
                        failCount++;
                        if (err.code === 'ER_DUP_ENTRY') {
                            dupEntryCount++;
                        }
                        outputStr = 'FAIL,' + moment().format(_format) + ',' + err.toString() + '\n';
                        fs.appendFile(outputFile, outputStr, function (err) {
                            if (err) throw err;
                            //console.log('file ' + outputFile + ' created/appended.');
                        });
                        //force no error
                        callback(null);
                    });
            }, function (err) {
                if (err) {
                    // one of the iterations produced an error.
                    // all processing will now stop.
                    console.log(err);
                } else {
                    //all iterations have been processed successfully
                    console.log(moment().format(_format) + ' - all active users for the day inserted');
                    callback(null);
                }
            });
        }
    ],
    function (err, result) {
        //after all functions in waterfall is finished
        if (err) {
            console.log(err)
        } else {
            outputStr = moment().format(_format) + ' - total: ' + collectionSize + ', pass: ' + passCount + ', fail: ' + failCount + ' (duplicate entry: ' + dupEntryCount + ')';
            console.log(outputStr);
            fs.appendFile(outputFile, outputStr, function (err) {
                if (err) throw err;
                //console.log('file ' + outputFile + ' created/appended.');
                console.log(moment().format(_format) + ' - file ' + outputFile + ' created/appended.');
                console.log(moment().format(_format) + ' - 01-get-users - *end*');
                process.exit();
            });
        }
    }
);