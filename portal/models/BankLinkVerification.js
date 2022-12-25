var knex = require('../config/database');
const bookshelf = require('bookshelf')(knex);
const User = require('./User');

var BankLinkVerification = bookshelf.Model.extend({
    tableName: 'bank_link_verifications',
    user: function() {
        return this.belongsTo(User);
    },
    hasTimestamps: ['created_at', 'updated_at'],
});

module.exports = BankLinkVerification;