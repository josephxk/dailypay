const crypto = require('crypto');
const knex = require('../config/database');
const bookshelf = require('bookshelf')(knex);
const Promise = require('bluebird');
const bcrypt = Promise.promisifyAll(require('bcrypt-nodejs'));
const Service = require('./Service');
const BankAccount = require('./BankAccount');
const BankLinkVerification = require('./BankLinkVerification');

const User = bookshelf.Model.extend({
    tableName: 'users',
    services: function() {
        return this.hasMany(Service);
    },
    bankAccounts: function() {
        return this.hasOne(BankAccount);
    },
    bankLinkVerifications: function() {
        return this.hasOne(BankLinkVerification);
    },
    hasTimestamps: ['created_at', 'updated_at'],
    initialize: function () {
        this.on('saving', this.onSaving, this);
    },
    onSaving: function (model, attrs, options) {
        var password = options.patch ? attrs.password : model.get('password')

        // self.get('password') returns undefined if password doesn't exist
        // so we must verify that these exist
        // if (model.get('password') === undefined) {
        //     throw Error('Password Required');
        // }
        // if (model.get('email') === undefined) {
        //     throw Error('Email Required');
        // }
        // normalize email address
        if (model.get('email') !== undefined) {
            model.set('email', model.get('email').toLowerCase().trim());
        }

        // salt and hash
        if (password !== undefined) {
            return bcrypt.genSaltAsync(10).then(function (salt) {
                return bcrypt.hashAsync(model.get('password'), salt, null).then(function (hash) {
                    if (options.patch) {
                        attrs.password = hash;
                    }
                    model.set('password', hash);
                });
            });
        }
    },
    comparePassword: function (candidatePassword, cb) {
        bcrypt.compare(candidatePassword, this.get('password'), function (err, isMatch) {
            cb(err, isMatch);
        });
    }
    ,
    gravatar: function (size) {
        if (!size) {
            size = 200;
        }
        if (!this.get('email')) {
            // return `https://gravatar.com/avatar/?s=${size}&d=retro`;
            return 'https://gravatar.com/avatar/?s=' + size.toString() + '&d=retro';
        }
        const md5 = crypto.createHash('md5').update(this.get('email')).digest('hex');
        // return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
        return 'https://gravatar.com/avatar/' + md5 + '?s=' + size.toString() + '&d=retro';
    }
});

//return user model if email and password are valid, null otherwise
// bookshelfUser.verify = Promise.method(function (email, password) {
//     if (!email || !password) return null;
//     return new User({email: email.toLowerCase().trim()})
//         .fetch().then(function (user) {
//             if (!user) return null;
//             return bcrypt.compareAsync(password, user.get('password')).then(function (match) {
//                 if (!match) return null;
//                 return user;
//             });
//         });
// });

module.exports = User;