// Imports the express Node module.
var express = require('express');
// Creates an Express server.
var app = express();
var util = require('./util.js');
var database = require('./database.js');
var bodyParser = require('body-parser');

// You run the server from `server`, so `../client/build` is `server/../client/build`.
// '..' means "go up one directory", so this translates into `client/build`!
app.use(express.static('../client/build'));

app.use(bodyParser.text());

/**
* Get the feed data for a particular user.
*/
app.get('/user/:userid/feed', function(req, res) {
// URL parameters are stored in req.params
var userid = req.params.userid;
// Send response.
res.send(getFeedData(userid));
});

/**
* Resolves a feed item. Internal to the server, since it's synchronous.
*/
function getFeedItemSync(feedItemId) {
var feedItem = database.readDocument('feedItems', feedItemId);
// Resolve 'like' counter.
feedItem.likeCounter = feedItem.likeCounter.map((id) =>
database.readDocument('users', id));
// Assuming a StatusUpdate. If we had other types of
// FeedItems in the DB, we would
// need to check the type and have logic for each type.
feedItem.contents.author = database.readDocument('users',
feedItem.contents.author);
// Resolve comment author.
feedItem.comments.forEach((comment) => {
comment.author = database.readDocument('users', comment.author);
});
return feedItem;
}
/**
* Get the feed data for a particular user.
*/
function getFeedData(user) {
var xhr = new XMLHttpRequest();
xhr.open('GET', '/user/4/feed');
xhr.setRequestHandler('Authorization', 'Bearer eyJpZCI6NH0=');
xhr.addEventListener('load', function(){
  //Call the callback with the data.
  cb(JSON.parse(xhr.responseText));
});
xhr.send();
}

/**
* Get the user ID from a token. Returns -1 (an invalid ID)
* if it fails.
*/
function getUserIdFromToken(authorizationLine) {
try {
// Cut off "Bearer " from the header value.
var token = authorizationLine.slice(7);
// Convert the base64 string to a UTF-8 string.
var regularString = new Buffer(token, 'base64').toString('utf8');
// Convert the UTF-8 string into a JavaScript object.
var tokenObj = JSON.parse(regularString);
var id = tokenObj['id'];
// Check that id is a number.
if (typeof id === 'number') {
return id;
} else {
// Not a number. Return -1, an invalid ID.
return -1;
}
} catch (e) {
// Return an invalid ID.
return -1;
}
}
/**
* Get the feed data for a particular user.
*/
app.get('/user/:userid/feed', function(req, res) {
var userid = req.params.userid;
var fromUser = getUserIdFromToken(req.get('Authorization'));
// userid is a string. We need it to be a number.
// Parameters are always strings.
var useridNumber = parseInt(userid, 10);
if (fromUser === useridNumber) {
// Send response.
res.send(getFeedData(userid));
} else {
// 401: Unauthorized request.
res.status(401).end();
}
});

var validate = require('express-jsonschema').validate;
var writeDocument = database.writeDocument;
var addDocument = database.addDocument;
//Also, add a bodyParser for JSON alongsize the existing body parser for text:
// Support receiving text in HTTP request bodies
app.use(bodyParser.text());
// Support receiving JSON in HTTP request bodies
app.use(bodyParser.json());
/**
* Adds a new status update to the database.
*/
function postStatusUpdate(user, location, contents, cb) {
sendXHR('POST', '/feeditem', {
userId: user,
location: location,
contents: contents
}, (xhr) => {
// Return the new status update.
cb(JSON.parse(xhr.responseText));
});
}

// `POST /feeditem { userId: user, location: location, contents: contents }`
app.post('/feeditem',
validate({ body: StatusUpdateSchema }), function(req, res) {
// If this function runs, `req.body` passed JSON validation!
var body = req.body;
var fromUser = getUserIdFromToken(req.get('Authorization'));
// Check if requester is authorized to post this status update.
// (The requester must be the author of the update.)
if (fromUser === body.userId) {
var newUpdate = postStatusUpdate(body.userId, body.location,
body.contents);
// When POST creates a new resource, we should tell the client about it
// in the 'Location' header and use status code 201.
res.status(201);
res.set('Location', '/feeditem/' + newUpdate._id);
// Send the update!
res.send(newUpdate);
} else {
// 401: Unauthorized.
res.status(401).end();
}
});

/**
* Translate JSON Schema Validation failures into error 400s.
*/
app.use(function(err, req, res, next) {
if (err.name === 'JsonSchemaValidation') {
// Set a bad request http response status
res.status(400).end();
} else {
// It's some other sort of error; pass it to next error middleware handler
next(err);
}
});


// Starts the server on port 3000!
app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
