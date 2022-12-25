const _ = require('lodash');
const passport = require('passport');
const request = require('request');
// const InstagramStrategy = require('passport-instagram').Strategy;
const LocalStrategy = require('passport-local').Strategy;
// const FacebookStrategy = require('passport-facebook').Strategy;
// const TwitterStrategy = require('passport-twitter').Strategy;
// const GitHubStrategy = require('passport-github').Strategy;
// const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
// const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
// const OpenIDStrategy = require('passport-openid').Strategy;
// const OAuthStrategy = require('passport-oauth').OAuthStrategy;
// const OAuth2Strategy = require('passport-oauth').OAuth2Strategy;

const User = require('../models/User'); //jk

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    //bookshelf
    User.forge({id: id})
        .fetch()
        .then(function (user) {
            done(null, user);
        })
});

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({usernameField: 'email'}, function (email, password, done) {
    //bookshelf
    User.forge({email: email.toLowerCase()})
        .fetch() //{withRelated: ['services', 'bankAccounts', 'bankLinkVerifications']}
        .then(function (user) {
            if (!user) {
                // return done(null, false, {msg: `Email ${this.get('email')} not found.`}); //too explicit
                return done(null, false, {msg: 'Invalid email or password.'});
            }

            user.comparePassword(password, function (err, isMatch) {
                if (isMatch) {
                    return done(null, user);
                }
                return done(null, false, {msg: 'Invalid email or password.'});
            })
        })
        .catch(function (err) {
            return done(null, false, {msg: err.toString()});
        });
}));

/**
 * Login Required middleware.
 */
exports.isAuthenticated = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = function (req, res, next) {
    const provider = req.path.split('/').slice(-1)[0];

    if (_.find(req.user.tokens, {kind: provider})) {
        next();
    } else {
        // res.redirect(`/auth/${provider}`);
        res.redirect('/auth/${provider}');
    }
};
