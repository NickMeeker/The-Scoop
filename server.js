// database is let instead of const to allow us to modify it in test.js
let database = {
  users: {},
  articles: {},
  comments: {},
  nextArticleId: 1,
  nextCommentId: 1
};

const routes = {
  '/users': {
    'POST': getOrCreateUser
  },
  '/users/:username': {
    'GET': getUser
  },
  '/articles': {
    'GET': getArticles,
    'POST': createArticle
  },
  '/articles/:id': {
    'GET': getArticle,
    'PUT': updateArticle,
    'DELETE': deleteArticle
  },
  '/articles/:id/upvote': {
    'PUT': upvoteArticle
  },
  '/articles/:id/downvote': {
    'PUT': downvoteArticle
  },
  '/comments': {
    'POST': postComment
  },
  '/comments/:id': {
    'PUT': updateComment,
    'DELETE': deleteComment
  },
  '/comments/:id/upvote': {
    'PUT': upvoteComment,
  },
  '/comments/:id/downvote': {
    'PUT': downvoteComment,
 }
};

function getUser(url, request) {
  const username = url.split('/').filter(segment => segment)[1];
  const user = database.users[username];
  const response = {};

  if (user) {
    const userArticles = user.articleIds.map(
        articleId => database.articles[articleId]);
    const userComments = user.commentIds.map(
        commentId => database.comments[commentId]);
    response.body = {
      user: user,
      userArticles: userArticles,
      userComments: userComments
    };
    response.status = 200;
  } else if (username) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function getOrCreateUser(url, request) {
  const username = request.body && request.body.username;
  const response = {};

  if (database.users[username]) {
    response.body = {user: database.users[username]};
    response.status = 200;
  } else if (username) {
    const user = {
      username: username,
      articleIds: [],
      commentIds: []
    };
    database.users[username] = user;

    response.body = {user: user};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function createArticle(url, request) {
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (requestArticle && requestArticle.title && requestArticle.url &&
      requestArticle.username && database.users[requestArticle.username]) {
    const article = {
      id: database.nextArticleId++,
      title: requestArticle.title,
      url: requestArticle.url,
      username: requestArticle.username,
      commentIds: [],
      upvotedBy: [],
      downvotedBy: []
    };

    database.articles[article.id] = article;
    database.users[article.username].articleIds.push(article.id);

    response.body = {article: article};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function getArticles(url, request) {
  const response = {};

  response.status = 200;
  response.body = {
    articles: Object.keys(database.articles)
        .map(articleId => database.articles[articleId])
        .filter(article => article)
        .sort((article1, article2) => article2.id - article1.id)
  };

  return response;
}

function getArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const article = database.articles[id];
  const response = {};

  if (article) {
    article.comments = article.commentIds.map(
      commentId => database.comments[commentId]);

    response.body = {article: article};
    response.status = 200;
  } else if (id) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function updateArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (!id || !requestArticle) {
    response.status = 400;
  } else if (!savedArticle) {
    response.status = 404;
  } else {
    savedArticle.title = requestArticle.title || savedArticle.title;
    savedArticle.url = requestArticle.url || savedArticle.url;

    response.body = {article: savedArticle};
    response.status = 200;
  }

  return response;
}

function deleteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const response = {};

  if (savedArticle) {
    database.articles[id] = null;
    savedArticle.commentIds.forEach(commentId => {
      const comment = database.comments[commentId];
      database.comments[commentId] = null;
      const userCommentIds = database.users[comment.username].commentIds;
      userCommentIds.splice(userCommentIds.indexOf(id), 1);
    });
    const userArticleIds = database.users[savedArticle.username].articleIds;
    userArticleIds.splice(userArticleIds.indexOf(id), 1);
    response.status = 204;
  } else {
    response.status = 400;
  }

  return response;
}

function upvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = upvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function downvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = downvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function upvote(item, username) {
  if (item.downvotedBy.includes(username)) {
    item.downvotedBy.splice(item.downvotedBy.indexOf(username), 1);
  }
  if (!item.upvotedBy.includes(username)) {
    item.upvotedBy.push(username);
  }
  return item;
}

function downvote(item, username) {
  if (item.upvotedBy.includes(username)) {
    item.upvotedBy.splice(item.upvotedBy.indexOf(username), 1);
  }
  if (!item.downvotedBy.includes(username)) {
    item.downvotedBy.push(username);
  }
  return item;
}

// POST for /comments
// Creates new comment on article
function postComment(url, request) {
  const requestComment = request.body && request.body.comment;
  const response = {};

  // Logic here is similar to article logic.
  // Checks if requestComment exists and all the necessary fields are included
  // in the body, returns 400 otherwise
  if (requestComment && requestComment.body && requestComment.username &&
      requestComment.articleId && database.users[requestComment.username] &&
      database.articles[requestComment.articleId]){

    // valid request, go ahead and makefunction the comment
    const comment = {
      // make sure to increment nextCommentId
      id: database.nextCommentId++,
      username: requestComment.username,
      body: requestComment.body,
      articleId: requestComment.articleId,
      upvotedBy: [],
      downvotedBy: []
    };


    // add it to the database and associate it with the user and article
    database.comments[comment.id] = comment;
    database.users[comment.username].commentIds.push(comment.id);
    database.articles[comment.articleId].commentIds.push(comment.id);

    // successful response
    response.body = {comment: comment};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

// PUT for /comments/:id
// The put function to edit comments by id.
// Parses the id from the url string and checks for a saved comment
// with that id. Logic is similar to updateArticle().
function updateComment(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedComment = database.comments[id];
  const requestComment = request.body && request.body.comment;
  const response = {};

  // returns 400 on bad request, 404 on non-existant comment id
  if (!id || !requestComment) {
    response.status = 400;
  } else if (!savedComment) {
    response.status = 404;
  } else {
    // update savedComment.body to requestComment.body or otherwise
    // default to savedComment.body (if requestComment.body doesn't exist)
    savedComment.body = requestComment.body || savedComment.body;

    // successful response
    response.body = {comment: savedComment};
    response.status = 200;
  }

  return response;
}

// DELETE for /comments/:id
// Similar logic to deleteArticle().
function deleteComment(url, request) {
  // parse id from url string, check for saved comment
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedComment = database.comments[id];
  const response = {};

  if (savedComment) {
    // set the comment to null
    // splice it from its user's commentIds array
    database.comments[id] = null;
    const userCommentIds = database.users[savedComment.username].commentIds;
    userCommentIds.splice(userCommentIds.indexOf(id), 1);

    // splice it from its article's commentIds array
    const articleCommentIds = database.articles[savedComment.articleId].commentIds;
    articleCommentIds.splice(articleCommentIds.indexOf(id), 1);
    // successful response
    response.status = 204;
  } else {
    // comment not found
    response.status = 404;
  }

  return response;
}

// PUT for /comments/:id/upvote
// Similar logic to upvoteArticle(). Upvotes comments.
function upvoteComment(url, request) {
  // parse id from url string, find user and comment
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedComment = database.comments[id];
  const response = {};

  // if both comment and user exist, upvote the comment
  // using its upvote function found in './src/components/Comment.js'
  if (savedComment && database.users[username]) {
    savedComment = upvote(savedComment, username);

    // successful response
    response.body = {comment: savedComment};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

// PUT for /comments/:id/downvote
// Similar logic to downvoteArticle(). Downvotes comments.
function downvoteComment(url, request) {
  // parse id from url string, find user and comment
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedComment = database.comments[id];
  const response = {};

  // if both comment and user exist, downvote the comment
  // using its downvote function found in './src/components/Comment.js'
  if (savedComment && database.users[username]) {
    savedComment = downvote(savedComment, username);

    // successful response
    response.body = {comment: savedComment};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

/*
 * Summary: Writes data to .yml files located in new database directory
 *
 * Description: Requires node-yaml module for writing to .yml file.
 * To install: npm install --save node-yaml.
 * For further documentation and support
 * concerning node-yaml, see: https://www.npmjs.com/package/node-yaml.
 *
 */
function saveDatabase(){
  yaml = require('node-yaml');
  filepath = "./database/users.yml";

  try {
    // pull all current info from the db
    users = database.users;
    articles = database.articles;
    comments = database.comments;

    // write the user information to the users.yml file
    yaml.writeSync(filepath, users, "utf8", function(err){
      if(err) throw err;
    });

    // write the articles information to the articles.yml file
    filepath = "./database/articles.yml";
    yaml.writeSync(filepath, articles, "utf8", function(err){
      if(err) throw err;
    });

    // write the comments information to the comments.yml file
    filepath = "./database/comments.yml";
    yaml.writeSync(filepath, comments, "utf8", function(err){
      if(err) throw err;
    });

  } catch (e) {
    console.log(e);
  }
}

/*
 * Summary: Loads data from database directory into active database instance.
 *
 * Description: Requires js-yaml module for easy convenient loading yaml files.
 * To install: npm install js-yaml
 * For further documentation and support
 * concerning js-yaml, see: https://www.npmjs.com/package/js-yaml
 */
function loadDatabase(){
  yaml = require('js-yaml');
  fs   = require('fs');
  filepath = "./database/users.yml";

  try{
    // Deal with users first
    // load all user data into one large user object
    var data = yaml.safeLoad(fs.readFileSync(filepath, 'utf8'));
    // iterate over the object according to its keys.
    // in this case, keys will represent individual users
    if(data){
      Object.keys(data).forEach(function(key) {
        // pull the current "value" from the yml data.
        // it will represent a user
        var val = data[key];
        const user = val;
        // add the user to the db
        database.users[user.username] = user;
      });
    }

    // Articles are handled exactly the same way as users
    filepath = "./database/articles.yml";
    data = yaml.safeLoad(fs.readFileSync(filepath, 'utf8'));
    if(data){
      Object.keys(data).forEach(function(key) {
        var val = data[key];
        const article = val;
        database.articles[article.id] = article;
        // just make sure to increment nextArticleId for each article
        database.nextArticleId++;
      });
    }

    // comments are handled the same way as articles
    filepath = "./database/comments.yml";
    data = yaml.safeLoad(fs.readFileSync(filepath, 'utf8'));
    if(data){
      Object.keys(data).forEach(function(key) {
        var val = data[key];
        const comment = val;
        database.comments[comment.id] = comment;
        database.nextCommentId++;
      });
    }
  } catch (e) {
    console.log(e);
  }
}
// Write all code above this line.

const http = require('http');
const url = require('url');

const port = process.env.PORT || 4000;
const isTestMode = process.env.IS_TEST_MODE;


const requestHandler = (request, response) => {
  const url = request.url;
  const method = request.method;
  const route = getRequestRoute(url);

  if (method === 'OPTIONS') {
    var headers = {};
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = false;
    headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
    response.writeHead(200, headers);
    return response.end();
  }

  response.setHeader('Access-Control-Allow-Origin', null);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader(
      'Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (!routes[route] || !routes[route][method]) {
    response.statusCode = 400;
    return response.end();
  }

  if (method === 'GET' || method === 'DELETE') {
    const methodResponse = routes[route][method].call(null, url);
    !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

    response.statusCode = methodResponse.status;
    response.end(JSON.stringify(methodResponse.body) || '');
  } else {
    let body = [];
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = JSON.parse(Buffer.concat(body).toString());
      const jsonRequest = {body: body};
      const methodResponse = routes[route][method].call(null, url, jsonRequest);
      !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

      response.statusCode = methodResponse.status;
      response.end(JSON.stringify(methodResponse.body) || '');
    });
  }
};

const getRequestRoute = (url) => {
  const pathSegments = url.split('/').filter(segment => segment);

  if (pathSegments.length === 1) {
    return `/${pathSegments[0]}`;
  } else if (pathSegments[2] === 'upvote' || pathSegments[2] === 'downvote') {
    return `/${pathSegments[0]}/:id/${pathSegments[2]}`;
  } else if (pathSegments[0] === 'users') {
    return `/${pathSegments[0]}/:username`;
  } else {
    return `/${pathSegments[0]}/:id`;
  }
}

if (typeof loadDatabase === 'function' && !isTestMode) {
  const savedDatabase = loadDatabase();
  if (savedDatabase) {
    for (key in database) {
      database[key] = savedDatabase[key] || database[key];
    }
  }
}

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) {
    return console.log('Server did not start succesfully: ', err);
  }

  console.log(`Server is listening on ${port}`);
});
