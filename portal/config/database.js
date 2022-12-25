const dotenv = require('dotenv');

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({path: '.env'});

var knex = require('knex')({
    client: 'mysql',
    debug: true,
    connection: {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASS,
        database: process.env.MYSQL_NAME,
    },
    pool: {
        min: 0,
        max: 7
    }
});

module.exports = knex;