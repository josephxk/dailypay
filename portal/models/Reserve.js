var knex = require('../config/database');
var bookshelf = require('bookshelf')(knex);
const User = require('./User');

bookshelf.plugin('pagination');
var Reserve = bookshelf.Model.extend({
    tableName: 'reserves',
    user: function() {
        return this.belongsTo(User);
    },
    hasTimestamps: ['created_at', 'updated_at'],
});

var Reserves = bookshelf.Collection.extend({
    model: Reserve
});

module.exports.Reserve = Reserve;
module.exports.Reserves = Reserves;