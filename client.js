const fs = require('fs');
const skypeHttp = require('skype-http');
const debug = require('debug')('matrix-puppet:skype:client');

// look at
// https://github.com/ocilo/skype-http/blob/master/src/example/main.ts

const Promise = require('bluebird');
const EventEmitter = require('events').EventEmitter;

const readFile = Promise.promisify(require('fs').readFile);
const writeFile = Promise.promisify(require('fs').writeFile);

class Client extends EventEmitter {
  constructor(auth) {
    super();
    this.api = null;
    this.auth = auth;
    this.lastMsgId = null;
  }
  connect() {
    const opts = {
      credentials: this.auth,
      verbose: true
    }

    console.log(opts);
    return skypeHttp.connect(opts).then(api => {
      this.api = api;

      console.log(api);
    });
  }
  getUserInfoById(userId) {
    const getUserInfo = Promise.promisify(this.api.getUserInfo);
    return getUserInfo([userId]).then(res=>{
      const userInfo = res[userId];
      debug('user info', userInfo);
      return userInfo;
    });
  }
  getThreadInfo(threadId) {
    const getThreadInfo = Promise.promisify(this.api.getThreadInfo);
    return getThreadInfo(threadId).then(res=>{
      debug('thread info', res);
      return res;
    });
  }
  sendMessage(threadId, msg) {
    const sendMessage = Promise.promisify(this.api.sendMessage);
    return sendMessage(msg, threadId).then(res=>{
      debug('sent msg, info back', res);
      return res;
    });
  }
  markAsRead(threadId) {
    return new Promise((resolve, reject) => {
      this.api.markAsRead(threadId, (err) => {
        if (err) {
          debug('fail when marked thread %s as read', threadId);
          debug(err);
        } else {
          debug('thread %s marked as read', threadId);
          resolve();
        }
      });
    });
  }
}

module.exports = Client;

if (!module.parent) {
  const client = new Client(require('./config.json').skype);
  client.connect();
}

