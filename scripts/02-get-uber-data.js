/*  joseph kwan
 *  read driver earnings from Uber accounts.
 *  1.  get all uber drivers for the particular date from w_users and build the array
 *  2.  get each driver's login credentials and retrieve the earnings for that date;
 *      update driver array; update table record with completed status
 *  3.  output to file
 */

var moment = require('moment');
var fs = require('fs');
var mysql = require('mysql');
var request = require('request');
var sanitizeHtml = require('sanitize-html');
var cheerio = require('cheerio');
var async = require('async');
var opts = {
    allowedTags: ['html', 'body', 'a', 'table', 'thead', 'th', 'tbody', 'tr', 'td'],
    allowedAttributes: {
        'a': ['href']
    },
    nonTextTags: ['style', 'script', 'textarea', 'noscript', 'title', 'nav', 'select', 'option', 'span', 'label']
}

var date;
var filename = './data/romeo-uber-' + date + '.sql';
var pool = mysql.createPool({
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'dailypay'
});
var _format = 'YYYY-MM-DD HH:mm:ss:SSS';

if (process.argv[2] === undefined) {
    date = moment().format('YYYY-MM-DD');
} else {
    date = process.argv[2];
}

console.log(moment().format(_format) + ' - Processing for the date: ' + date + ' ...');

var extractDriverTrips = function (err, contents) {
    var sanitizedHtml, $tripRow, $tripCol;

    sanitizedHtml = sanitizeHtml(contents, opts)
    sanitizedHtml = sanitizedHtml.replace(/^\s*$[\n\r]{1,}/gm, ''); //remove blank lines
    // console.log(sanitizedHtml);

    $tripRow = cheerio.load(sanitizedHtml);
    $tripRow('body > table:nth-child(3) > tbody > tr').each(function (i, elem) {
        var tripId, date, driver, duration, km, fare, status;
        var line;

        //process the rows with trip data
        if (elem.children.length > 3) {

            //iterate the columns of trip data
            $tripCol = cheerio.load($tripRow(this).html())
            // console.log('row ' + i + ':');
            $tripCol('td').each(function (j, jelem) {
                if (j === 0) { //date + trip id
                    tripId = $tripCol('a').attr('href').replace('https://partners.uber.com/trips/', '');
                    date = $tripCol(this).text();
                } else if (j === 1) { //driver
                    driver = $tripCol(this).text();
                } else if (j === 2) { //duration
                    duration = $tripCol(this).text();
                } else if (j === 3) { //km
                    km = $tripCol(this).text();
                } else if (j === 4) { //fare
                    fare = $tripCol(this).text();
                } else if (j === 5) { //status
                    status = $tripCol(this).text();
                }
            });

            if (status.indexOf('Canceled') != -1) {
                duration = '0';
                km = '0';
            }

            line = tripId + ';' + date + ';' + driver + ';' + duration + ';' + km + ';' + fare + ';' + status + '\n';
            console.log(line);

            //append to file
            fs.appendFile(filename, line, function (err) {
                if (err) throw err;
                // console.log('data appended.');
            });
        }
    });
};

pool.getConnection(function (err, connection) {
    if (err) throw err;

    //start async waterfall
    //http://stackoverflow.com/questions/32639517/async-waterfall-not-passing-callback-for-nested-mysql-queries
    async.waterfall([
        prepareUsersForProcessing
        // getUberDrivers,
        // getDriverTrips,
        // saveToFile
    ], function (err, result) {
        console.log(result);
        pool.end(function (err) {
            console.log('connections in the pool ended.')
        });
    });

    function prepareUsersForProcessing(callback) {
        //get all valid users for the day's processing and put them into a working table.
        //insert into table ... on duplicate key update column ...
        var statement = 'insert into w_users (user_id, email, date, service, done) ' +
                        '(select id, email, ' + '\'' + date.toString() + '\'' + ' as date, \'uber\' as service, false as done from users ' +
                        'where regStatus = 7 and ' +
                        'active = true) ' +
                        'on duplicate key update ' +
                        'counter = counter + 1';
        console.log(moment().format(_format) + ' - Preparing statement: ' + statement);
        console.log(moment().format(_format) + ' - Executing statement ...');
        connection.query(
            statement, function (err, rows, fields) {
            if (err) throw err;

            for (i = 0; i < rows.length; i++) {
                console.log(rows[i].email);
            }

            connection.release();


            callback(null, "ok");

        });
    }


    function getUberDrivers(callback) {
        connection.query('select id, user_id, date, service, done from w_users where date =', function (err, rows, fields) {
            if (err) throw err;

            for (i = 0; i < rows.length; i++) {
                console.log(rows[i].id);
            }

            connection.release();

            callback(null, result);
        });
    }

    function getDriverTrips(result) {
        callback(null, result);
    }

    function saveToFile(result) {
        callback(null, result);
    }


});

// fs.readFile('./test/static_files/uber-driver-partner-summary-and-trips.html', 'utf8', extractDriverTrips);
//
// console.log('after calling readFile');




