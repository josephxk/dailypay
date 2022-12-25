var knex = require('../config/database');
const bookshelf = require('bookshelf')(knex);
const User = require('./User');

bookshelf.plugin('pagination');
var Service = bookshelf.Model.extend({
    tableName: 'services',
    user: function() {
        return this.belongsTo(User);
    },
    hasTimestamps: ['created_at', 'updated_at'],
});

var Services = bookshelf.Collection.extend({
    model: Service
});

module.exports.Service = Service;
module.exports.Services = Services;