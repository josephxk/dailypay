/**
 * Constants
 */
/*
 *  field regStatus: 1-link accounts; 2-add bank account; 4-daily bank link; 7-completed
 */
exports.SIGNUP_LINK_ACCOUNTS = 1;
exports.SIGNUP_ADD_BANK_ACCOUNT = 2;
exports.SIGNUP_VERIFY_BANK_LINK = 4;
exports.SIGNUP_COMPLETED = 7;

/*
 *  pagination base urls
 */
exports.PAGINATION_BASE_PAYMENTS = 'payments?page=';