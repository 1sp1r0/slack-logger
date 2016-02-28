var passport = require('passport');

var passportFunction = function (app) {
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser(function (user, done) {
        done(null, user);
    });
    passport.deserializeUser(function (user, done) {
        // User is what we stores in the done function above.
        done(null, user);
    });

    require('./strategies/local.strategy')();
};

module.exports = passportFunction;