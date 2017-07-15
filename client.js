const fs = require('fs');
const skypeHttp = require('skype-http');
const debug = require('debug')('matrix-puppet:skype:client');
const Promise = require('bluebird');

// look at
// https://github.com/ocilo/skype-http/blob/master/src/example/main.ts
const EventEmitter = require('events').EventEmitter;

const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

class Client extends EventEmitter {
  constructor(auth) {
    super();
    this.api = null;
    this.auth = auth;
    this.lastMsgId = null;
    this.selfSentFiles = [];
  }
  removeSelfSentFile(s) {
    let match = false;
    while (true) {
      let i = this.selfSentFiles.indexOf(s);
      if (i == -1) {
        return match;
      }
      match = true;
      this.selfSentFiles.splice(i, 1);
    }
  }
  connect() {
    const opts = {
      credentials: this.auth,
      verbose: true
    }

    return skypeHttp.connect(opts).then(api => {
      this.api = api;

      api.on("event", (ev) => {
        //console.log(ev);

        if (ev && ev.resource) {
          switch (ev.resource.type) {
            case "Text":
            case "RichText":
              if (ev.resource.from.username === api.context.username) {
                // the lib currently hides this kind from us. but i want it.
                if (ev.resource.content.slice(-1) !== '\ufeff') {
                  this.emit('sent', ev.resource);
                }
              } else {
                this.emit('message', ev.resource);
              }
              break;
            case "RichText/UriObject":
              if (!this.removeSelfSentFile(ev.resource.original_file_name)) {
                if (ev.resource.from.username === api.context.username) {
                  ev.resource.from.raw = undefined;
                }
                this.emit('image', ev.resource)
              }
              break;
          }
        }
      });

      // Log every error
      api.on("error", (err) => {
        console.error("An error was detected:");
        console.error(err);
        this.emit('error', err);
      });

      return api.getContacts().then((contacts)=>{
        this.contacts = contacts;
        console.log(`got ${contacts.length} contacts`);

        console.log('listening for events');
        return api.listen();
      });
    }).then(()=>{
      console.log('setting status online');
      return this.api.setStatus('Online');

      console.log(api);
    }).catch(err=>{
      console.log(err);
      process.exit(0);
    });
  }
  sendMessage(threadId, msg) {
    return this.api.sendMessage(msg, threadId);
  }
  sendPictureMessage(threadId, data) {
    this.selfSentFiles.push(data.name);
    return this.api.sendImage({
      file: data.file,
      name: data.name
    }, threadId).catch((err) => {
      this.removeSelfSentFile(data.name);
      this.api.sendMessage({ textContent: '[Image] <a href="'+entities.encode(data.url)+'">'+entities.encode(data.name)+'</a>' }, threadId);
    });
  }
  getContact(id) {
    let contact = this.contacts.find((c) => {
      return c.id.id === id || c.id.raw === id;
    });
    if (contact) {
      return contact;
    }
  }
}

module.exports = Client;

if (!module.parent) {
  const client = new Client(require('./config.json').skype);
  client.connect().then(function() {
    client.on('message', (ev) => {
      console.log('>>> message', ev);
    });

    client.on('sent', (ev) => {
      console.log('>>> sent', ev);
    });

    client.sendMessage('8:green.streak', { textContent: 'test from nodejs' });
  });
}
