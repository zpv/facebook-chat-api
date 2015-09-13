var login = require('../index.js');
var fs = require('fs');
var assert = require('assert');

var conf = JSON.parse(fs.readFileSync('test/test-config.json', 'utf8'));
var credentials = {
  email: conf.user.email,
  password: conf.user.password,
};

try {
  credentials.appState = JSON.parse(fs.readFileSync('test/test-appstate.json', 'utf8'));
} catch (e) {}

var userIDs = conf.userIDs;

var options = {
  selfListen: true,
  listenEvents: true,
  logLevel: "silent",
  pageID: conf.pageID
};
var getType = require('../utils').getType;

var userID = conf.user.id;

var groupChatID;
var groupChatName;

function checkErr(done){
  return function(err) {
    if (err) done(err);
  };
}

describe('Login:', function() {
  var api = null;
  var tests = [];
  var stopListening;
  this.timeout(20000);

  function listen(done, matcher) {
    tests.push({matcher:matcher, done:done});
  }

  before(function(done) {
    login(credentials, options, function (err, localAPI) {
      if(err) return done(err);

      assert(localAPI);
      api = localAPI;
      stopListening = api.listen(function (err, msg) {
        if (err) throw err;
        // Removes matching function and calls corresponding done
        tests = tests.filter(function(test) {
          return !(test.matcher(msg) && (test.done() || true));
        });
      });

      fs.writeFileSync('test/test-appstate.json', JSON.stringify(api.getAppState()));
      done();
    });
  });

  it('should login without error', function (){
    assert(api);
  });

  it('should get the right user ID', function (){
    assert(userID == api.getCurrentUserID());
  });

  it('should send text message object (user)', function (done){
    var body = "text-msg-obj-" + Date.now();
    listen(done, function (msg) {
      return msg.type === 'message' && msg.body === body;
    });
    api.sendMessage({body: body}, userID, checkErr(done));
  });

  it('should send sticker message object (user)', function (done){
    var stickerID = '767334526626290';
    listen(done, function (msg) {
      return msg.type === 'message' &&
        msg.attachments.length > 0 &&
        msg.attachments[0].type === 'sticker' &&
        msg.attachments[0].stickerID === stickerID;
    });
    api.sendMessage({sticker: stickerID}, userID, checkErr(done));
  });

  it('should send basic string (user)', function (done){
    var body = "basic-str-" + Date.now();
    listen(done, function (msg) {
      return (msg.type === 'message' && msg.body === body);
    });
    api.sendMessage(body, userID, checkErr(done));
  });

  it('should send typing indicator', function (done) {
    var stopType = api.sendTypingIndicator(userID, function(err) {
      checkErr(done)(err);
      stopType();
      done();
    });
  });

  it('should get a list of online users', function (done){
    api.getOnlineUsers(function(err, res) {
      checkErr(done)(err);
      assert(getType(res) === "Array");
      res.map(function(v) {
        assert(v.timestamp);
        assert(v.userID);
        assert(v.statuses);
        assert(v.statuses.status);
        assert(v.statuses.webStatus);
        assert(v.statuses.fbAppStatus);
        assert(v.statuses.messengerStatus);
        assert(v.statuses.otherStatus);
      });
      done();
    });
  });

  it('should get the right user info', function (done) {
    api.getUserInfo(userID, function(err, data) {
      checkErr(done)(err);
      var user = data[userID];
      assert(user.name);
      assert(user.firstName);
      assert(user.vanity !== null);
      assert(user.profileUrl);
      assert(user.gender);
      assert(user.type);
      assert(!user.isFriend);
      done();
    });
  });

  it('should get the list of friends', function (done) {
    api.getFriendsList(userID, function(err, data) {
      checkErr(done)(err);
      assert(getType(data) === "Array");
      data.map(function(v) {parseInt(v);});
      done();
    });
  });

  after(function (){
    if (stopListening) stopListening();
  });
});
