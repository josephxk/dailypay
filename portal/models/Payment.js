var knex = require('../config/database');
var bookshelf = require('bookshelf')(knex);
const User = require('./User');

bookshelf.plugin('pagination');
var Payment = bookshelf.Model.extend({
    tableName: 'payments',
    user: function() {
        return this.belongsTo(User);
    },
    // paymentItems: function() {
    //     return this.hasMany(PaymentItem);
    // },
    hasTimestamps: ['created_at', 'updated_at'],
});

// var Payments = bookshelf.Collection.extend({
//     model: Payment
// });

// var PaymentItem = bookshelf.Model.extend({
//     tableName: 'payment_items',
//     user: function() {
//         return this.belongsTo(User);
//     },
//     paymentHeader: function() {
//         return this.belongsTo(Payment);
//     },
//     hasTimestamps: ['created_at', 'updated_at'],
// });

module.exports.Payment = Payment;
//module.exports.Payments = Payments;