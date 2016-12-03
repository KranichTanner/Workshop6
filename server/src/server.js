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

// Reset database.
app.post('/resetdb', function(req, res) {
console.log("Resetting database...");
// This is a debug route, so don't do any validation.
database.resetDatabase();
// res.send() sends an empty response with status code 200
res.send();
});

// Update a feed item.
app.put('/feeditem/:feeditemid/content', function(req, res) {
var fromUser = getUserIdFromToken(req.get('Authorization'));
var feedItemId = req.params.feeditemid;
var feedItem = database.readDocument('feedItems', feedItemId);
// Check that the requester is the author of this feed item.
if (fromUser === feedItem.contents.author) {
// Check that the body is a string, and not something like a JSON object.
// We can't use JSON validation here, since the body is simply text!
if (typeof(req.body) !== 'string') {
// 400: Bad request.
res.status(400).end();
return;
}
// Update text content of update.
feedItem.contents.contents = req.body;
writeDocument('feedItems', feedItem);
res.send(getFeedItemSync(feedItemId));
} else {
// 401: Unauthorized.
res.status(401).end();
}
});

/**
* Delete a feed item.
*/
app.delete('/feeditem/:feeditemid', function(req, res) {
var fromUser = getUserIdFromToken(req.get('Authorization'));
// Convert from a string into a number.
var feedItemId = parseInt(req.params.feeditemid, 10);
var feedItem = database.readDocument('feedItems', feedItemId);
// Check that the author of the post is requesting the delete.
if (feedItem.contents.author === fromUser) {
database.deleteDocument('feedItems', feedItemId);
// Remove references to this feed item from all other feeds.
var feeds = database.getCollection('feeds');
var feedIds = Object.keys(feeds);
feedIds.forEach((feedId) => {
var feed = feeds[feedId];
var itemIdx = feed.contents.indexOf(feedItemId);
if (itemIdx !== -1) {
// Splice out of array.
feed.contents.splice(itemIdx, 1);
// Update feed.
database.writeDocument('feeds', feed);
}
});
// Send a blank response to indicate success.
res.send();
} else {
// 401: Unauthorized.
res.status(401).end();
}
});

// Like a feed item.
app.put('/feeditem/:feeditemid/likelist/:userid', function(req, res) {
var fromUser = getUserIdFromToken(req.get('Authorization'));
// Convert params from string to number.
var feedItemId = parseInt(req.params.feeditemid, 10);
var userId = parseInt(req.params.userid, 10);
if (fromUser === userId) {
var feedItem = database.readDocument('feedItems', feedItemId);
// Add to likeCounter if not already present.
if (feedItem.likeCounter.indexOf(userId) === -1) {
feedItem.likeCounter.push(userId);
writeDocument('feedItems', feedItem);
}
// Return a resolved version of the likeCounter
res.send(feedItem.likeCounter.map((userId) =>
database.readDocument('users', userId)));
} else {
// 401: Unauthorized.
res.status(401).end();
}
});

// Unlike a feed item.
app.delete('/feeditem/:feeditemid/likelist/:userid', function(req, res) {
var fromUser = getUserIdFromToken(req.get('Authorization'));
// Convert params from string to number.
var feedItemId = parseInt(req.params.feeditemid, 10);
var userId = parseInt(req.params.userid, 10);
if (fromUser === userId) {
var feedItem = database.readDocument('feedItems', feedItemId);
var likeIndex = feedItem.likeCounter.indexOf(userId);
// Remove from likeCounter if present
if (likeIndex !== -1) {
feedItem.likeCounter.splice(likeIndex, 1);
writeDocument('feedItems', feedItem);
}
// Return a resolved version of the likeCounter
// Note that this request succeeds even if the
// user already unliked the request!
res.send(feedItem.likeCounter.map((userId) =>
database.readDocument('users', userId)));
} else {
// 401: Unauthorized.
res.status(401).end();
}
});

// Search for feed item
app.post('/search', function(req, res) {
var fromUser = getUserIdFromToken(req.get('Authorization'));
var user = database.readDocument('users', fromUser);
if (typeof(req.body) === 'string') {
// trim() removes whitespace before and after the query.
// toLowerCase() makes the query lowercase.
var queryText = req.body.trim().toLowerCase();
// Search the user's feed.
var feedItemIDs = database.readDocument('feeds', user.feed).contents;
// "filter" is like "map" in that it is a magic method for
// arrays. It takes an anonymous function, which it calls
// with each item in the array. If that function returns 'true',
// it will include the item in a return array. Otherwise, it will
// not.
// Here, we use filter to return only feedItems that contain the
// query text.
// Since the array contains feed item IDs, we later map the filtered
// IDs to actual feed item objects.
res.send(feedItemIDs.filter((feedItemID) => {
var feedItem = database.readDocument('feedItems', feedItemID);
return feedItem.contents.contents
.toLowerCase()
.indexOf(queryText) !== -1;
}).map(getFeedItemSync));
} else {
// 400: Bad Request.
res.status(400).end();
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
