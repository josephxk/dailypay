const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');

var mailgun = require('nodemailer-mailgun-transport');//jk
const knex = require('../config/database'); //jk
var bookshelf = require('bookshelf')(knex); //jk
const User = require('../models/User'); //jk
const Service = require('../models/Service').Service; //jk
const Services = require('../models/Service').Services; //jk
const Reserve = require('../models/Reserve').Reserve; //jk
const Reserves = require('../models/Reserve').Reserves; //jk
const BankAccount = require('../models/BankAccount'); //jk
const BankLinkVerification = require('../models/BankLinkVerification'); //jk
//const Payments = require('../models/Payment').Payments; //jk
const Payment = require('../models/Payment').Payment; //jk
const _ = require('lodash');
var moment = require('moment'); //jk
var shortid = require('shortid'); //jk
const constants = require('../constants');

/**
 * GET /login
 * Login page.
 */
exports.getLogin = function (req, res) {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('account/login', {
        title: 'Login'
    });
};

/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = function (req, res, next) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();
    var nextRoute;

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/login');
    }

    passport.authenticate('local', function (err, user, info) {

        if (err) {
            return next(err);
        }
        if (!user) {
            req.flash('errors', info);
            return res.redirect('/login');
        }
        req.logIn(user, function (err) {
            if (err) {
                return next(err);
            }

            req.flash('success', {msg: 'Success! You are logged in.'});
            nextRoute = getNextRoute(user.get('reg_status'));
            res.redirect(nextRoute);
        });
    })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */
exports.logout = function (req, res) {
    req.logout();
    res.redirect('/');
};

/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = function (req, res) {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('account/signup', {
        title: 'Create Account'
    });
};

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = function (req, res, next) {
    req.assert('firstName', 'First name is required').notEmpty();
    req.assert('lastName', 'Last name is required').notEmpty();
    req.assert('phone', 'Phone number is required').notEmpty();
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();
    var nextRoute;

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/signup');
    }

    //bookshelf
    User.forge({email: req.body.email.toLowerCase()})
        .fetch()
        .then(function (user) {
            if (user) {
                req.flash('errors', {msg: 'Account with that email address already exists.'});
                return res.redirect('/signup');
            }

            this.set({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                phone: req.body.phone,
                email: req.body.email,
                password: req.body.password
            })

            this.save()
                .then(function (user) {
                    req.logIn(user, function (err) {
                        if (err) {
                            return next(err);
                        }

                        nextRoute = getNextRoute(user.get('reg_status'));
                        res.redirect(nextRoute);
                    });
                })
                .catch(function (err) {
                    return next(err);
                });
        })
        .catch(function (err) {
            return next(err);
        });
};

/**
 * GET /account
 * Profile page.
 */
exports.getAccount = function (req, res) {
    res.render('account/profile', {
        title: 'Account Management',
        user: req.user
    });
};

/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = function (req, res, next) {
    req.assert('firstName', 'First name is required').notEmpty();
    req.assert('lastName', 'Last name is required').notEmpty();
    req.assert('phone', 'Phone number is required').notEmpty();
    req.assert('email', 'Please enter a valid email address.').isEmail();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }

    //bookshelf
    User.forge({id: req.user.id})
        .fetch()
        .then(function (existingUser) {
            if (user) {
                this.save({
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    phone: req.body.phone,
                    email: req.body.email
                }, {
                    patch: true
                })
                    .then(function (user) {
                        if (!user) {
                            return next(err);
                        }
                        req.flash('success', {msg: 'Profile information has been updated.'});
                        res.redirect('/account');
                    })
                    .catch(function (err) { //save fail
                        if (err.errno === 1062) { //duplicate entry
                            req.flash('errors', {msg: 'The email address you have entered is already associated with an account.'});
                            return res.redirect('/account');
                        }
                    });
            } else { //user not found
                return next(err);
            }

        })
        .catch(function (err) { //fetch fail
            return next(err);
        });
};

/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = function (req, res, next) {
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }

    //bookshelf
    User.forge({id: req.user.id})
        .fetch()
        .then(function (user) {
            if (user) {
                // user.set('password', req.body.password);
            } else {
                req.flash('errors', {msg: 'Password has not been changed.'});
                res.redirect('/account');
            }

            //passing in option patch=true causes event handler to use data from {attrs} only
            this.save({password: req.body.password}, {patch: true})
                .then(function (user) {
                    if (!user) {
                        return next(err);
                    }
                    req.flash('success', {msg: 'Password has been changed.'});
                    res.redirect('/account');
                })
                .catch(function (err) { //save fail
                    return next(err);
                });
        })
        .catch(function (err) { //fetch fail
            return next(err);
        });
};

/**
 * POST /account/delete
 * Delete user account.
 */
// exports.postDeleteAccount = (req, res, next) => {
//   User.remove({ _id: req.user.id }, (err) => {
//     if (err) { return next(err); }
//     req.logout();
//     req.flash('info', { msg: 'Your account has been deleted.' });
//     res.redirect('/');
//   });
// };

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
// exports.getOauthUnlink = (req, res, next) => {
//   const provider = req.params.provider;
//   User.findById(req.user.id, (err, user) => {
//     if (err) { return next(err); }
//     user[provider] = undefined;
//     user.tokens = user.tokens.filter(token => token.kind !== provider);
//     user.save((err) => {
//       if (err) { return next(err); }
//       req.flash('info', { msg: `${provider} account has been unlinked.` });
//       res.redirect('/account');
//     });
//   });
// };

/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = function (req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }

    User.forge({passwordResetToken: req.params.token})
        .where('passwordResetExpires', '>', Date.now())
        .fetch()
        .then(function (user) {
            if (user) {
                res.render('account/reset', {
                    title: 'Password Reset'
                });
            } else {
                req.flash('errors', {msg: 'Password reset token is invalid or has expired.'});
                return res.redirect('/forgot');
            }
        })
        .catch(function (err) { //fetch fail
            return next(err);
        });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = function (req, res, next) {
    req.assert('password', 'Password must be at least 4 characters long.').len(4);
    req.assert('confirm', 'Passwords must match.').equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
    }

    async.waterfall([
        function (done) {

            //bookshelf
            User.forge({passwordResetToken: req.params.token})
                .where('passwordResetExpires', '>', Date.now())
                .fetch()
                .then(function (user) {
                    if (user) {
                        // user.set('password', req.body.password);
                        // user.set('passwordResetToken', null);
                        // user.set('passwordResetExpires', null);
                        this.save({
                            password: req.body.password,
                            passwordResetToken: null,
                            passwordResetExpires: null
                        }, {
                            patch: true
                        })
                            .then(function (user) {
                                req.logIn(user, function (err) {
                                    done(err, user);
                                });
                            })
                            .catch(function (err) { //save fail

                            });
                    } else {
                        req.flash('errors', {msg: 'Password reset token is invalid or has expired.'});
                        return res.redirect('back');
                    }
                })
                .catch(function (err) { //fetch fail
                    return next(err);
                })
        },
        function (user, done) {
            var auth = {
                auth: {
                    api_key: process.env.MAILGUN_KEY,
                    domain: process.env.MAILGUN_DOMAIN
                }
            }

            const transporter = nodemailer.createTransport(mailgun(auth));
            const mailOptions = {
                to: user.attributes.email,
                from: 'admin@dev.dailypay.com',
                subject: 'Your Daily Pay password has been changed',
                text: `Hello,\n\nThis is a confirmation that the password for your account ${user.get('email')} has just been changed.\n`
            };
            transporter.sendMail(mailOptions, function (err) {
                req.flash('success', {msg: 'Success! Your password has been changed.'});
                done(err);
            });
        }
    ], function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
};

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = function (req, res) {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.render('account/forgot', {
        title: 'Forgot Password'
    });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = function (req, res, next) {
    req.assert('email', 'Please enter a valid email address.').isEmail();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/forgot');
    }

    async.waterfall([
        function (done) {
            crypto.randomBytes(16, function (err, buf) {
                const token = buf.toString('hex');
                done(err, token);
            });
        },
        function (token, done) {
            User.forge({email: req.body.email})
                .fetch()
                .then(function (user) {
                    if (user) {
                        this.save({
                            passwordResetToken: token,
                            passwordResetExpires: Date.now() + 3600000 // 1 hour
                        }, {
                            patch: true
                        })
                            .then(function (user) {
                                done(null, token, user);
                            })
                            .catch(function (err) { //save fail
                                return next(err);
                            });
                    } else {
                        req.flash('errors', {msg: 'Account with that email address does not exist.'});
                        return res.redirect('/forgot');
                    }
                })
                .catch(function (err) { //fetch fail
                    return next(err);
                });
        },
        function (token, user, done) {
            var auth = {
                auth: {
                    api_key: process.env.MAILGUN_KEY,
                    domain: process.env.MAILGUN_DOMAIN
                }
            }

            const transporter = nodemailer.createTransport(mailgun(auth));

            const mailOptions = {
                to: user.attributes.email,
                from: 'admin@dev.dailypay.com',
                subject: 'Reset your password on Daily Pay',
                text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          http://${req.headers.host}/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`
            };
            transporter.sendMail(mailOptions, function (err) {
                req.flash('info', {msg: `An e-mail has been sent to ${user.get('email')} with further instructions.`});
                done(err);
            });
        }
    ], function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/forgot');
    });
};

/**
 * GET /app/dashboard
 * User Dashboard page.
 */
exports.getUserDashboard = function (req, res) {

    async.parallel([
            function (callback) {
                Payment.forge()
                    .query({
                        limit: 7
                    })
                    .where({
                        user_id: req.user.id
                    })
                    .orderBy('job_period', 'desc')
                    .fetchAll()
                    .then(function (payments) {
                        callback(null, payments)
                    })
                    .catch(function (err) { //fetch fail
                        callback(err);
                    });
            },
            function (callback) {
                Reserve.forge({user_id: req.user.id})
                    .query({
                        limit: 5,
                        where: {user_id: req.user.id}
                    })
                    //.where('reserve_date', '>=', moment().subtract(2, 'days').format('YYYY-MM-DD'))
                    .orderBy('reserve_date', 'desc')
                    .fetchAll()
                    .then(function (reserves) {
                        callback(null, reserves)
                    })
                    .catch(function (err) { //fetch fail
                        callback(err);
                    });
            }
        ],
        function (err, results) {
            res.render('app/user_dashboard', {
                title: 'Dashboard',
                subtitle: 'Activity Overview',
                user: req.user,
                payments: results[0].toJSON() || {},
                reserves: results[1].toJSON() || {}
                //pagination: payments.pagination || {}
            });
        }
    );
};

/**
 * GET /app/welcome/set_services
 * Services page for new sign ups
 */
exports.getWelcomeSetServices = function (req, res) {

    res.render('app/welcome_set_services', {
        title: 'Welcome to DailyPay',
        subtitle: 'Need Help? 65-xxxx-xxxx',
        user: req.user
    });
};

/**
 * POST /app/welcome/set_services
 * Update services for new sign ups.
 */
exports.postWelcomeSetServices = function (req, res, next) {
    req.assert('services', 'At least one provider is required').notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/app/welcome/set_services');
    }

    //consider only Uber now
    if (_.includes(req.body.services, 'uber')) {
        res.redirect('/app/uber/provider_account/new');
    } else {
        return res.redirect('/app/welcome/set_services');
    }
};

/**
 * GET /app/uber/provider_account/new
 * Uber provider account page.
 */
exports.getNewUberProviderAccount = function (req, res) {
    res.render('app/uber_service', {
        title: 'Connect Your Accounts',
        subtitle: 'Subtitle',
        user: req.user
    });
};

/**
 * POST /app/uber/provider_account/new
 * Update Uber provider account.
 */
exports.postNewUberProviderAccount = function (req, res, next) {
    req.assert('email', 'Email is required').len(2);
    req.assert('password', 'Password is required').len(4);

    const errors = req.validationErrors();
    var nextRoute,
        nextRegStatus;

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/app/uber/provider_account/new');
    }

    //assume adding service is successful and prepare next variables
    if (req.user.get('reg_status') != constants.SIGNUP_COMPLETED) {
        nextRegStatus = req.user.get('reg_status') + constants.SIGNUP_LINK_ACCOUNTS;
        nextRoute = getNextRoute(nextRegStatus);
    }

    //transaction - set registration status and insert service
    bookshelf.transaction(function (t) {
        return new User({id: req.user.id, reg_status: nextRegStatus})
            .save(null, {transacting: t})
            .tap(function (user) {
                return Service.forge({
                    user_id: user.get('id'),
                    service: 'uber',
                    u: req.body.email,
                    p: req.body.password,
                    valid: false
                })
                    .save(null, {transacting: t})
                    .then(function () {
                        req.flash('success', {msg: 'Uber parter account added.'});
                        res.redirect(nextRoute);
                    })
                    .catch(function (err) { //service insert fail
                        t.rollback();
                        if (err.errno === 1062) { //duplicate entry
                            req.flash('errors', {msg: 'You have previously added an Uber account.'});
                            return res.redirect('/app/uber/provider_account/new');
                        }
                    });
            })
            .catch(function (err) {
                t.rollback();
                return next(err); //user update fail
            });
    });
};

/**
 * GET /app/bank_account/new
 * New bank page.
 */
exports.getNewBankAccount = function (req, res) {
    res.render('app/bank_account', {
        title: 'Add Bank Account',
        subtitle: 'Subtitle',
        user: req.user
    });
};

/**
 * POST /app/bank_account/new
 * Update new bank account.
 */
exports.postNewBankAccount = function (req, res, next) {
    req.assert('bankName', 'Bank is required').notEmpty();
    req.assert('bankAccount', 'Account is required').notEmpty();
    if (req.body.bankAccount.length > 0) {
        var regex = new RegExp('^[0-9]+$');
        if (regex.test(req.body.bankAccount)) {
            //
        } else {
            req.assert('bankAccount', 'Account must contain only numbers').isInt();
        }
    }

    const errors = req.validationErrors();
    var nextRoute,
        nextRegStatus;

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/app/bank_account/new');
    }

    //assume adding service is successful and prepare next variables
    if (req.user.get('reg_status') != constants.SIGNUP_COMPLETED) {
        nextRegStatus = req.user.get('reg_status') + constants.SIGNUP_ADD_BANK_ACCOUNT;
        nextRoute = getNextRoute(nextRegStatus);
    }

    //transaction - set registration status and insert bank account
    bookshelf.transaction(function (t) {
        return new User({id: req.user.id, reg_status: nextRegStatus})
            .save(null, {transacting: t})
            .tap(function (user) {
                return BankAccount.forge({
                    user_id: user.get('id'),
                    bank: req.body.bankName,
                    account: req.body.bankAccount
                })
                    .save(null, {transacting: t})
                    .then(function () {
                        req.flash('success', {msg: 'Bank account added.'});
                        res.redirect(nextRoute);
                    })
                    .catch(function (err) { //bank account insert fail
                        t.rollback();
                        if (err.errno === 1062) { //duplicate entry
                            req.flash('errors', {msg: 'You have previously added a bank account.'});
                        }
                        return res.redirect('/app/bank_account/new');
                    });
            })
            .catch(function (err) {
                t.rollback();
                return next(err); //user update fail
            });
    });
}

/**
 * GET /app/bank_link/verify
 * Verify Bank Link page.
 */
exports.getVerifyBankLink = function (req, res) {
    res.render('app/verify_bank_link', {
        title: 'Verify Bank Link',
        subtitle: 'Subtitle',
        user: req.user
    });
};

/**
 * POST /app/bank_link/verify
 * Update verification of bank link.
 */
exports.postVerifyBankLink = function (req, res, next) {
    req.assert('verified', 'Verification and acknowledgement is required').notEmpty();

    const errors = req.validationErrors();
    var nextRoute,
        nextRegStatus;

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/app/bank_link/verify');
    }

    //assume adding service is successful and prepare next variables
    if (req.user.get('reg_status') != constants.SIGNUP_COMPLETED) {
        nextRegStatus = req.user.get('reg_status') + constants.SIGNUP_VERIFY_BANK_LINK;
        nextRoute = getNextRoute(nextRegStatus);
    }

    //transaction - set registration status and insert bank account
    bookshelf.transaction(function (t) {
        return new User({id: req.user.id, reg_status: nextRegStatus})
            .save(null, {transacting: t})
            .tap(function (user) {
                return BankLinkVerification.forge({
                    user_id: user.get('id'),
                    verified: req.body.verified === 'on'
                })
                    .save(null, {transacting: t})
                    .then(function () {
                        req.flash('success', {msg: 'Your verification and acknowledgement has been recorded.'});
                        res.redirect(nextRoute);
                    })
                    .catch(function (err) { //verify bank link insert fail
                        t.rollback();
                        if (err.errno === 1062) { //duplicate entry
                            req.flash('errors', {msg: 'You have previously verified and acknowledged.'});
                        }
                        return res.redirect('/app/bank_link/verify');
                    });
            })
            .catch(function (err) {
                t.rollback();
                return next(err); //user update fail
            });
    });
}

/**
 * GET /app/dashboard/payments
 * Payments page.
 */
exports.getPayments = function (req, res) {

    Payment.forge()
    // .query({where: {user_id: req.user.id}})
        .where({
            user_id: req.user.id
        })
        .orderBy('job_period', 'desc')
        .fetchPage({
            pageSize: 7,
            page: req.query.page
        })
        .then(function (payments) {
            if (payments) {
                // res.locals.payments = payments;
                payments.pagination = generatePagination(payments.pagination);
                payments.pagination.base = constants.PAGINATION_BASE_PAYMENTS;
            } else {
                // req.flash('errors', {msg: 'error message.'});
                // return res.redirect('/app/dashboard');
            }

            res.render('app/payments', {
                title: 'Payments',
                subtitle: 'Overview',
                user: req.user,
                payments: payments.toJSON() || {},
                pagination: payments.pagination || {}
            });
        })
        .catch(function (err) { //fetch fail
            return next(err);
        });
};

/**
 * GET /payments/:uuid
 * Payment Statement page.
 */
exports.getPayment = function (req, res, next) {

    //var paymentItems;

    Payment.forge()
        .where({
            user_id: req.user.id,
            uuid: req.params.uuid
        })
        //.fetch({withRelated: ['paymentItems']})
        .fetch()
        .then(function (payment) {

            //paymentItems = paymentHeader.related('paymentItems').toJSON();

            res.render('app/payment_statement', {
                title: 'Payment',
                subtitle: 'Day Period Statement',
                user: req.user,
                payment: payment.toJSON() || {}//,
                //paymentItems: paymentItems || {}
            });

        })
        .catch(function (err) {
            console.log(err);
        });
};

/**
 * GET /app/dashboard/provider_accounts
 * Provider Accounts page.
 */
exports.getProviderAccounts = function (req, res) {
    Services
        .query({where: {user_id: req.user.id}})
        .fetch()
        .then(function (services) {
            if (services) {

            } else {

            }
            res.render('app/provider_accounts', {
                title: 'DailyPay Hub',
                subtitle: 'Provider Accounts',
                user: req.user,
                services: services.toJSON() || {}
            });
        })
        .catch(function (err) {

        });
}

function generatePagination(pagination) {
    // rowCount: 805, // Total number of rows found for the query before pagination
    // pageCount: 81, // Total number of pages of results
    // page: 2, // The requested page number
    // pageSze: 10, // The requested number of rows per page

    var startPage = 0;
    var endPage = 0;
    var numPages = 8; //number of pages in the component
    var base = base || '#';
    var numGroups = 0;
    var isFirstPage = false;
    var isLastPage = false;
    var prev = 0; //the previous page number
    var next = 0; //the next page number
    var currentGroup = 0;

    isFirstPage = pagination.page === 1;
    isLastPage = pagination.page === pagination.pageCount;

    next = pagination.page < pagination.pageCount ? pagination.page + 1 : 0;
    prev = pagination.page > 1 ? pagination.page - 1 : 0;

    numGroups = Math.ceil(pagination.pageCount / numPages);

    //pagination.page = pagination.page > pagination.pageCount ? pagination.pageCount : pagination.page;

    for (var i = 1; i <= numGroups; i++) {
        currentGroup = i;
        startPage = ((i - 1) * numPages) + 1;

        endPage = i * numPages;
        endPage = endPage >= pagination.pageCount ? pagination.pageCount : endPage;

        if (pagination.page >= startPage && pagination.page <= endPage) {
            break;
        }
    }

    pagination.startPage = startPage;
    pagination.endPage = endPage;
    pagination.nextPage = next;
    pagination.prevPage = prev;
    pagination.isFirstPage = isFirstPage;
    pagination.isLastPage = isLastPage;
    pagination.base = base;

    return pagination;
}


function getNextRoute(regStatus) {
    var nextRoute,
        notDone;

    if (regStatus == constants.SIGNUP_COMPLETED) {
        nextRoute = '/app/dashboard'
    } else {
        notDone = constants.SIGNUP_COMPLETED - regStatus;

        if ((notDone == 7) || (notDone == 5) || (notDone == 3) || (notDone == 1)) {
            nextRoute = '/app/welcome/set_services';
        } else if (notDone == 6) {
            nextRoute = '/app/bank_account/new';
        } else if (notDone == 4) {
            nextRoute = '/app/bank_link/verify';
        } else if (notDone == 2) {
            nextRoute = '/app/bank_account/new';
        } else {
            nextRoute = '/app/welcome/set_services';
        }
    }

    // if (notDone == 7) {
    //     nextRoute = '/app/welcome/set_services';
    // } else if (notDone == 6) {
    //     nextRoute = '/app/bank_account/new';
    // } else if (notDone == 5) {
    //     nextRoute = '/app/welcome/set_services';
    // } else if (notDone == 4) {
    //     nextRoute = '/app/bank_link/verify';
    // } else if (notDone == 3) {
    //     nextRoute = '/app/welcome/set_services';
    // } else if (notDone == 2) {
    //     nextRoute = '/app/bank_account/new';
    // } else if (notDone == 1) {
    //     nextRoute = '/app/welcome/set_services';
    // } else if (notDone == 0) {
    //     nextRoute = '/app/dashboard'
    // } else {
    //     nextRoute = '/app/welcome/set_services';
    // }

    return nextRoute;
}