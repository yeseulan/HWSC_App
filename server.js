const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser'); // use for POST
const clientHandler = require('./scripts/client_handler');
const db = require('./scripts/db.js');
const http_code = require('./scripts/http_code');
var User = require('./scripts/mongoose_user_schema');
var session = require('express-session');


const app = express();
const router = express.Router();  // get an instance of the express Router

// uncomment after placing your favicon in /public  (order mattered)
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/build', express.static(path.join(__dirname, 'build')));
app.use(express.static(path.join(__dirname, 'templates')));
app.use(session({
    secret: 'work hard',   // need to change, this is website example?
    resave: true,
    saveUninitialized: false
}));

// middleware to use for all requests
router.use(function (req, res, next) {
    // do logging
    console.log('Routing');
    next(); // make sure we go to the next routes and don't stop here
});

// test route to make sure everything is working (accessed at GET http://localhost:port/query)
router.get('/', function (req, res) {
    console.log('/query');
    res.json({message: 'Construction in Progress'});
});


// TODO not sure how this works yet
router.get('/logout', function(req, res, next) {
    if (req.session) {
        // delete session object
        req.session.destroy(function(err) {
            if(err) {
                return next(err);
            } else {
                return res.redirect('/');
            }
        });
    }
});

// for list of schools
router.route('/resources').get(function (req, res) {
    clientHandler.serviceResource(req.query, function(err,result) {
        var returnValue = {
            error: err,
            result: result
        };
        if(err) {
            res.status(http_code.INTERNAL_SERVER_ERROR);
            returnValue.error = "Internal Server Error";
        }
        res.json(result);
    })
});

// test route to make sure everything is working (accessed at GET http://localhost:port/query/metadata)
router.route('/metadata').get(function (req, res) {
    console.log('/query/metadata');
    if (Object.keys(req.query).length !== 0 || req.query.constructor !== Object) {
        clientHandler.serviceQuery(req.query, function (err, result) {
            db.queryMetaData(db.HWSS_DB, db.METADATA, result, function (err, result) {
                var returnValue = {
                    error: err,
                    result: result
                };
                // console.log("[DEBUG]: result " + result);
                // console.log("[DEBUG]: err " + err);
                if (err || result.length === 0) {
                    res.status(http_code.NOT_FOUND);
                    returnValue.error = "Not Found";
                }
                res.json(returnValue);

            });
        })
    } else {
        res.status(http_code.NOT_FOUND);
        res.json({
            error: "Invalid Query",
            result: null
        });
    }
});


router.route('/validate').post(function(request,response) {
    if(request.body.email && request.body.password) {
        User.validate(request.body.email, request.body.password, function(err,user){
            var responseMsg = {};
            if(err || !user) {
                if (err !== undefined && user === undefined) {
                    responseMsg.code = 'wrongEmail';
                    responseMsg.msg = "Email does not exist";
                }
                else {
                    responseMsg.code = 'wrongPassword';
                    responseMsg.msg = "Incorrect password";
                }
            }
            else {
                request.session.userId = user._id;
                responseMsg.code = 'correct';
            }
            return response.send(responseMsg);
        });
    }
});

// insert new users into database of users
router.route('/insert').post(function(request, response){
    var newUser = new User.user(request.body);
    var responseMsg = "";
    newUser.save(function(err) {
        if(err) {
            if(err.code === 11000) {
                responseMsg = request.body.email + " already exists."
            }
            else {
                response.status(http_code.INTERNAL_SERVER_ERROR);
               responseMsg = "Cannot insert user into database";
            }
        }
        else {
            request.session.userId = newUser._id;
            responseMsg = "success";
        }
        response.send(responseMsg);
    });
});



// register route for http://localhost:port/query/
app.use('/query', router);
app.use('/register', router);
app.use('/login', router);
// sample query
// localhost:3009/query/metadata?pi=Seger,Faraon&firstName=Kerri,Conard

var port = process.env.PORT || 8080;

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = http_code.NOT_FOUND;
    next(err);
});

app.listen(port, function () {
    console.log(__dirname);
    console.log('example app listening on port 8080!');

});
