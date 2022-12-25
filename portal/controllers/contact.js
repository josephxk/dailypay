const nodemailer = require('nodemailer');
var mailgun = require('nodemailer-mailgun-transport');//jk

var auth = {
    auth: {
        api_key: process.env.MAILGUN_KEY,
        domain: process.env.MAILGUN_DOMAIN
    }
}

const transporter = nodemailer.createTransport(mailgun(auth));

/**
 * GET /contact
 * Contact form page.
 */
exports.getContact = function (req, res) {
    res.render('contact', {
        title: 'Contact'
    });
};

/**
 * POST /contact
 * Send a contact form via Nodemailer.
 */
exports.postContact = function (req, res) {
    req.assert('name', 'Name cannot be blank').notEmpty();
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('message', 'Message cannot be blank').notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/contact');
    }

    const mailOptions = {
        to: 'josephkwan@gmail.com',
        from: `${req.body.name} <${req.body.email}>`,
        subject: 'Contact Form | Project Delta Pi',
        text: req.body.message
    };

    transporter.sendMail(mailOptions, function (err) {
        if (err) {
            req.flash('errors', {msg: err.message});
            return res.redirect('/contact');
        }
        req.flash('success', {msg: 'Email has been sent successfully!'});
        res.redirect('/contact');
    });
};
