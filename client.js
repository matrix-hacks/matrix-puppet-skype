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

      api.on("event", (ev) => {
        //console.log(JSON.stringify(ev, null, 2));

        if (ev && ev.resource && ev.resource.type === "Text" || ev.resource.type === "RichText") {
          if (ev.resource.from.username === api.context.username) {
            // the lib currently hides this kind from us. but i want it.

            this.emit('sent', ev.resource);
          } else {
            this.emit('message', ev.resource);
          }

        }
      });

      // Log every error
      api.on("error", (err) => {
        console.error("An error was detected:");
        console.error(err);
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
  handleMessage(resource) {
    console.log('>>>>handle message', resource);
  }
  sendMessage(threadId, msg) {
    return this.api.sendMessage(msg, threadId).then(res=>{
      debug('sent msg, info back', res);
      return res;
    }).catch(console.error);
  }
  getContactName(id) {
    let contact = this.contacts.find((c)=> {
      return c.id.id === id || c.id.raw === id;
    });
    if (contact)
      return contact.name.displayName;
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

