var knex = require('../config/database');
const bookshelf = require('bookshelf')(knex);
const User = require('./User');

var BankAccount = bookshelf.Model.extend({
    tableName: 'bank_accounts',
    user: function() {
        return this.belongsTo(User);
    },
    hasTimestamps: ['created_at', 'updated_at'],
});

module.exports = BankAccount;