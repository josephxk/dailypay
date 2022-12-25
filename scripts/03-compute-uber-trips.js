/*  joseph kwan
 *  generate the payment details
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
var dateFrom, dateTo, timeCutOff;

//get the date parameter e.g 2016-08-17
if (process.argv[2] === undefined) {
    date = moment().format('YYYY-MM-DD');
} else {
    date = moment(process.argv[2]);
}

//+test - job_period 2016-08-09
date = moment('2016-10-02');
//-test

outputFile = './log/03-compute-uber-trips-' + date.format('YYYY-MM-DD') + '.txt';
dateFrom = moment(date).subtract(1, 'days');
dateTo = moment(date);

console.log(moment().format(_format) + ' - 03-compute-uber-trips - *start*');

async.waterfall([
        //get the raw uber trips from table
        function (callback) {
            knex.select([
                'user_id',
                'partner_id',
                'trip_id',
                'trip_date',
                'vehicle',
                'trip_time',
                'driver',
                'duration',
                'distance',
                'fare',
                'status'
            ])
                .from('proc_raw_uber_trips')
                .where(function () {
                    this.where('trip_date', dateFrom.format('YYYY-MM-DD')).andWhere('trip_time', '>=', '17:30:00')
                })
                .orWhere(function () {
                    this.where('trip_date', dateTo.format('YYYY-MM-DD')).andWhere('trip_time', '<', '17:30:00')
                })
                .then(function (trips) {
                    //no error, and pass in the users array
                    console.log(moment().format(_format) + ' - fetched raw trips');
                    callback(null, trips);
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
        //generate payment parameters and values for each trip, for the job period
        function (trips, callback) {
            outputStr = '';
            //collectionSize = _.size(trips);

            async.each(trips, function (trip, callback) {
                var tripDate,
                    tripTime,
                    tripDateTime,
                    dateFrom,
                    dateTo,
                    jobPeriod,
                    advanceDate,
                    advanceAmount,
                    payPeriodStart,
                    payPeriodEnd,
                    reserveDate,
                    reserveAmount;

                //set trip datetime
                tripDate = moment(trip.trip_date, 'YYYY-MM-DD');
                tripTime = moment(trip.trip_time, 'HH:mm:ss');
                tripDateTime = moment()
                    .year(tripDate.year()).month(tripDate.month()).date(tripDate.date())
                    .hour(tripTime.hour()).minute(tripTime.minute()).second(tripTime.second());

                //set job period
                dateFrom = moment(tripDate);
                dateFrom.subtract(1, 'days').hour('17').minute('30').second('00');

                dateTo = moment(tripDate);
                dateTo.hour('17').minute('30').second('00');

                if (tripDateTime.isSameOrAfter(dateFrom) && tripDateTime.isBefore(dateTo)) {
                    jobPeriod = moment(tripDate);
                } else {
                    jobPeriod = moment(tripDate);
                    jobPeriod.add(1, 'days');
                }

                //set advance payment date
                advanceDate = moment(jobPeriod);
                advanceDate.add(1, 'days');

                //set advance amount
                advanceAmount = Number(Math.round((trip.fare * 0.9) + 'e2') + 'e-2');

                //get Uber's pay period range (for SG market).
                //Each pay period begins on Monday at 4am and ends on the following Monday at 3:59am.
                payPeriodStart = moment(tripDate);
                payPeriodStart.day(tripDate.day() + (1 - tripDate.day()));
                payPeriodStart.hour('04').minute('00').second('00');

                payPeriodEnd = moment(tripDate);
                payPeriodEnd.day(tripDate.day() + (8 - tripDate.day()));
                payPeriodEnd.hour('03').minute('59').second('59');

                //set reserve date
                reserveDate = moment(tripDate);
                if (tripDateTime.isSameOrAfter(payPeriodStart) && tripDateTime.isSameOrBefore(payPeriodEnd)) {
                    reserveDate.day(tripDate.day() + (11 - tripDate.day()));
                } else {
                    reserveDate.day(tripDate.day() + (4 - tripDate.day()));
                }

                //set reserve amount
                reserveAmount = Number(Math.round((trip.fare * 0.1) + 'e2') + 'e-2');

                //update trip object
                trip.trip_date = moment(tripDate).format('YYYY-MM-DD');
                trip.trip_time = moment(tripTime).format('HH:mm:ss');
                trip.trip_datetime = moment(tripDateTime).format('YYYY-MM-DD HH:mm:ss');
                trip.job_period = moment(jobPeriod).format('YYYY-MM-DD');
                //trip.pay_period_start = moment(payPeriodStart).format('YYYY-MM-DD HH:mm:ss');
                //trip.pay_period_end = moment(payPeriodEnd).format('YYYY-MM-DD HH:mm:ss');
                trip.advance_date = moment(advanceDate).format('YYYY-MM-DD');
                trip.advance_amount = advanceAmount;
                trip.reserve_date = moment(reserveDate).format('YYYY-MM-DD');
                trip.reserve_amount = reserveAmount;
                //trip.counter = 0;
                //trip.processed = 0;
                trip.created_at = moment().format('YYYY-MM-DD HH:mm:ss');
                trip.updated_at = moment().format('YYYY-MM-DD HH:mm:ss');

                //assume no errors for this iteration
                callback(null);
            }, function (err) {
                if (err) {
                    // one of the iterations produced an error.
                    // all processing will now stop.
                    console.log(moment().format(_format) + ' ' + err);
                } else {
                    //all iterations have been processed successfully
                    console.log(moment().format(_format) + ' - all trips computed')
                }
            }); //async.each()


            //pass the computed trips to next function
            callback(null, trips);
        },
        //insert the computed trips into table
        function (computedTrips, callback) {
            outputStr = '';
            collectionSize = _.size(computedTrips);

            async.eachSeries(computedTrips, function (computedTrip, callback) {

                knex.insert({
                    id: null,
                    user_id: computedTrip.user_id,
                    partner_id: computedTrip.partner_id,
                    trip_id: computedTrip.trip_id,
                    trip_date: computedTrip.trip_date,
                    vehicle: computedTrip.vehicle,
                    trip_time: computedTrip.trip_time,
                    driver: computedTrip.driver,
                    duration: computedTrip.duration,
                    distance: computedTrip.distance,
                    fare: computedTrip.fare,
                    status: computedTrip.status,
                    trip_datetime: computedTrip.trip_datetime,
                    job_period: computedTrip.job_period,
                    //pay_period_start: computedTrip.pay_period_start,
                    //pay_period_end: computedTrip.pay_period_end,
                    advance_date: computedTrip.advance_date,
                    advance_amount: computedTrip.advance_amount,
                    reserve_date: computedTrip.reserve_date,
                    reserve_amount: computedTrip.reserve_amount,
                    //counter: 0,
                    //processed: 0,
                    created_at: computedTrip.created_at,
                    updated_at: computedTrip.updated_at
                })
                    .into('proc_computed_uber_trips')
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
                    console.log(moment().format(_format) + ' - all unique computed trips inserted');
                    callback(null);
                }
            }); //async.eachSeries()

        }
    ],
    function (err, result) {
        //after all functions in waterfall is finished
        if (err) {
            console.log(moment().format(_format) + ' ' + err);
        } else {
            outputStr = moment().format(_format) + ' - total: ' + collectionSize + ', pass: ' + passCount + ', fail: ' + failCount + ' (duplicate entry: ' + dupEntryCount + ')';
            console.log(outputStr);
            fs.appendFile(outputFile, outputStr, function (err) {
                if (err) throw err;
                console.log(moment().format(_format) + ' - file ' + outputFile + ' created/appended.');
                console.log(moment().format(_format) + ' - 03-compute-uber-trips - *end*');
                process.exit();
            });
        }
    }
); //async.waterfall()