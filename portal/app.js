/**
 * Module dependencies.
 */
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const flash = require('express-flash');
const path = require('path');
const passport = require('passport');
const expressValidator = require('express-validator');
const sass = require('node-sass-middleware');
const multer = require('multer');
const upload = multer({dest: path.join(__dirname, 'uploads')});
const knex = require('./config/database'); //jk
const KnexStore = require('connect-session-knex')(session); //jk

const KnexSessionStore = new KnexStore({
    knex: knex,
    tablename: 'sessions' // optional. Defaults to 'sessions'
});

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({path: '.env'});

/**
 * Controllers (route handlers).
 */
const homeController = require('./controllers/home');
const userController = require('./controllers/user');
// const apiController = require('./controllers/api');
const contactController = require('./controllers/contact');

/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();
app.locals.moment = require('moment'); //momentjs
app.locals.numeral = require('numeral'); //numeral

/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(compression());
app.use(sass({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public')
}));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressValidator());
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    store: KnexSessionStore
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(function (req, res, next) {
    if (req.path === '/api/upload') {
        next();
    } else {
        lusca.csrf()(req, res, next);
    }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use(function (req, res, next) {
    if (req.user && req.user.attributes.password) {
        delete req.user.attributes.password; //delete the password from the session //jk
    }
    res.locals.user = req.user;
    next();
});
app.use(function (req, res, next) {
    // After successful login, redirect back to the intended page
    if (!req.user &&
        req.path !== '/login' &&
        req.path !== '/signup' && !req.path.match(/^\/auth/) && !req.path.match(/\./)) {
        req.session.returnTo = req.path;
    }
    next();
});
app.use(express.static(path.join(__dirname, 'public'), {maxAge: 31557600000}));

/**
 * Primary app routes.
 */
app.get('/', homeController.index);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConfig.isAuthenticated, userController.getAccount);
app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
// app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
// app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);
app.get('/app/dashboard', passportConfig.isAuthenticated, userController.getUserDashboard); //jk
app.get('/app/welcome/set_services', passportConfig.isAuthenticated, userController.getWelcomeSetServices); //jk
app.post('/app/welcome/set_services', passportConfig.isAuthenticated, userController.postWelcomeSetServices); //jk
app.get('/app/uber/provider_account/new', passportConfig.isAuthenticated, userController.getNewUberProviderAccount); //jk
app.post('/app/uber/provider_account/new', passportConfig.isAuthenticated, userController.postNewUberProviderAccount); //jk
app.get('/app/bank_account/new', passportConfig.isAuthenticated, userController.getNewBankAccount); //jk
app.post('/app/bank_account/new', passportConfig.isAuthenticated, userController.postNewBankAccount); //jk
app.get('/app/bank_link/verify', passportConfig.isAuthenticated, userController.getVerifyBankLink); //jk
app.post('/app/bank_link/verify', passportConfig.isAuthenticated, userController.postVerifyBankLink); //jk
app.get('/app/payments', passportConfig.isAuthenticated, userController.getPayments); //jk
app.get('/app/payments/:uuid', passportConfig.isAuthenticated, userController.getPayment); //jk
app.get('/app/provider_accounts', passportConfig.isAuthenticated, userController.getProviderAccounts); //jk

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), function () {
    console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;