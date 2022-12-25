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
        // debug: 'true'
    }
});

var date, outputFile, outputStr;
var collectionSize = 0;
var passCount = 0;
var failCount = 0;
var dupEntryCount = 0;
var _format = 'YYYY-MM-DD HH:mm:ss:SSS';
//var dateFrom, dateTo, timeCutOff;
var idgen = require('idgen');

//get the date parameter e.g 2016-08-17
if (process.argv[2] === undefined) {
    date = moment().format('YYYY-MM-DD');
} else {
    date = moment(process.argv[2]);
}

//+test - job_period 2016-08-09
date = moment('2016-10-02');
//-test

outputFile = './log/04-generate-payments-' + date.format('YYYY-MM-DD') + '.txt';
dateFrom = moment(date).subtract(1, 'days');
dateTo = moment(date);

console.log(moment().format(_format) + ' - 04-generate-payments - *start*');

async.waterfall([
        //get the computed uber trips, and do summation for each user's day
        function (callback) {
            knex.select([
                'user_id',
                'job_period',
                'advance_date'
            ])
                .sum('fare as sum_fare')
                .sum('advance_amount as sum_advance_amount')
                .sum('reserve_amount as sum_reserve_amount')
                .from('proc_computed_uber_trips')
                .where(function () {
                    this.where('status', 'Completed').andWhere('job_period', date.format('YYYY-MM-DD'))
                })
                .groupBy('user_id', 'job_period')
                .then(function (payments) {
                    //no error, and pass in the array
                    console.log(moment().format(_format) + ' - fetched computed uber trips, and summed payments');
                    callback(null, payments);
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
        //generate payment parameters and values for each user, for the job period
        function (payments, callback) {
            outputStr = '';
            //collectionSize = _.size(trips);

            async.each(payments, function (payment, callback) {
                //compute with rollover payments - todo
                //check for minimum advance - todo

                //fee amount
                //$0.99 when fare < $150, $1.49 when fare >= $150
                if (payment.sum_fare < 150.00) {
                    payment.fee = 0.99;
                } else {
                    payment.fee = 1.49;
                }

                if (payment.fee > 0.00) {
                    payment.payment_amount = payment.sum_fare - payment.sum_reserve_amount - payment.fee;
                } else {
                    payment.payment_amount = 0.00;
                }

                //update payment object with other fields
                payment.uuid = 0;
                payment.job_period = moment(payment.job_period).format('YYYY-MM-DD');
                //nett_amount
                payment.advance_date = moment(payment.advance_date).format('YYYY-MM-DD');
                //advance_amount
                //reserve_date - not required at header
                //reserve_amount
                //payment.rollover_period = ;
                payment.rollover_amount = 0.00;
                //payment.fee =
                //payment.payment_amount =
                payment.paid = 0;
                payment.rollover = 0;
                payment.created_at = moment().format('YYYY-MM-DD HH:mm:ss');
                payment.updated_at = moment().format('YYYY-MM-DD HH:mm:ss');

                //assume no errors for this iteration
                //callback(null); --don't do this premature call
            }, function (err) {
                if (err) {
                    // one of the iterations produced an error.
                    // all processing will now stop.
                    console.log(moment().format(_format) + ' ' + err);
                } else {
                    //all iterations have been processed successfully
                    console.log(moment().format(_format) + ' - all payments for the day computed')
                }
            }); //async.each()


            //pass the computed payments to next function
            callback(null, payments);
        },
        //insert the computed payments into table
        function (computedPayments, callback) {
            outputStr = '';
            collectionSize = _.size(computedPayments);

            async.eachSeries(computedPayments, function (computedPayment, callback) {

                knex.insert({
                    id: null,
                    user_id: computedPayment.user_id,
                    uuid: idgen(8), //computedPayment.uuid,
                    job_period: computedPayment.job_period,
                    nett_amount: computedPayment.sum_fare,
                    advance_date: computedPayment.advance_date,
                    advance_amount: computedPayment.sum_advance_amount,
                    //reserve_date: computedPayment.reserve_date,
                    reserve_amount: computedPayment.sum_reserve_amount,
                    rollover_period: null, //computedPayment.rollover_period,
                    rollover_amount: computedPayment.rollover_amount,
                    fee_amount: computedPayment.fee,
                    payment_amount: computedPayment.payment_amount,
                    paid: computedPayment.paid,
                    rollover: computedPayment.rollover,
                    created_at: computedPayment.created_at,
                    updated_at: computedPayment.updated_at
                })
                    .into('payments')
                    .then(function (row) {
                        //process.stdout.write('.');
                        passCount++;
                        outputStr = 'PASS,' + moment().format(_format) + ',' + row.toString() + '\n';
                        fs.appendFile(outputFile, outputStr, function (err) {
                            if (err) throw err;
                            //console.log('file ' + outputFile + ' created/appended.');
                        });

                        //store the last insert id, then insert the reserve payments (child records)
                        computedPayment.last_insert_id = row[0];

                        //callback(null); --this is a premature call
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
                //assume no errors for this iteration
                callback(null);??
            }, function (err) {
                if (err) {
                    // one of the iterations produced an error.
                    // all processing will now stop.
                    console.log(err);
                } else {
                    //all iterations have been processed successfully
                    console.log(moment().format(_format) + ' - all unique computed payments inserted/updated');
                    callback(null);
                }
            }); //async.eachSeries()

            //pass the computed payments to next function
            callback(null, computedPayments);
        },
        //insert the reserve payments into table
        function (completedPayments, callback) {
            console.log('insert reserve')
            callback(null);
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
                console.log(moment().format(_format) + ' - 04-generate-payments - *end*');
                process.exit();
            });
        }
    }
); //async.waterfall()