const {
  MatrixAppServiceBridge: {
    Cli, AppServiceRegistration
  },
  Puppet,
  MatrixPuppetBridgeBase
} = require("matrix-puppet-bridge");
const SkypeClient = require('./client');
const config = require('./config.json');
const path = require('path');
const puppet = new Puppet(path.join(__dirname, './config.json' ));
const debug = require('debug')('matrix-puppet:skype');
const { skypeify, deskypeify } = require('./skypeify');
const tmp = require('tmp');
const Promise = require('bluebird');
const fs = require('fs');
const { download, entities } = require('./utils');

const a2b = a => new Buffer(a).toString('base64');
const b2a = b => new Buffer(b, 'base64').toString('ascii');

class App extends MatrixPuppetBridgeBase {
  getServicePrefix() {
    return "skype";
  }
  getServiceName() {
    return "Skype";
  }
  initThirdPartyClient() {
    this.client = new SkypeClient(config.skype);

    this.client.on('error', (err) => {
      this.sendStatusMsg({}, err);
    });

    this.client.on('message', (data) => {
      debug('message', data);
      const {
        type,
        from: { raw },
        conversation, content
      } = data;

      this.handleSkypeMessage({
        type: type,
        roomId: a2b(conversation),
        sender: raw,
        content: content
      });
    });

    this.client.on('sent', (data) => {
      debug('sent', data);
      const { type, conversation, content } = data;

      this.handleSkypeMessage({
        type: type,
        roomId: a2b(conversation),
        sender: undefined,
        content: content
      });
    });

    this.client.on('image', (data) => {
      const {
        type,
        from: { raw },
        conversation, uri, original_file_name
      } = data;
      this.handleSkypeImage({
        type: type,
        roomId: a2b(conversation),
        sender: raw,
        url: uri+'/views/imgpsh_fullsize',
        name: original_file_name
      });
    });

    return this.client.connect();
  }
  getThirdPartyUserDataById_noPromise(id) {
    let contact = this.client.getContact(id);
    let payload = {}
    if (contact) {
      payload.senderName = contact.name.displayName;
      payload.avatarUrl = contact.avatarUrl;
    } else if (data.sender.indexOf(":") =! -1) {
      payload.senderName = data.sender.substr(data.sender.indexOf(":")+1);
      payload.avatarUrl = 'https://avatars.skype.com/v1/avatars/' + entities.encode(payload.senderName) + '/public?returnDefaultImage=false&cacheHeaders=true';
    } else {
      payload.senderName = id;
    }
    return payload;
  }
  getPayload(data) {
    let payload = {
      roomId: data.roomId.replace(':', '^'),
    };
    if (data.sender === undefined) {
      payload.senderId = undefined;
    } else {
      payload.senderId = a2b(data.sender);
      Object.assign(payload, this.getThirdPartyUserDataById_noPromise(data.sender));
    }
    console.log(payload);
    return payload;
  }
  handleSkypeMessage(data) {
    let payload = this.getPayload(data);
    payload.text = deskypeify(data.content);
    return this.handleThirdPartyRoomMessage(payload);
  }
  handleSkypeImage(data) {
    let payload = this.getPayload(data);
    payload.text = data.name;
    payload.path = ''; // needed to not create internal errors
    return this.client.downloadImage(data.url).then(({ buffer, type }) => {
      payload.buffer = buffer;
      payload.mimetype = type;
      return this.handleThirdPartyRoomImageMessage(payload);
    }).catch((err) => {
      console.log(err);
      payload.text = '[Image] ('+data.name+') '+data.url;
      return this.handleThirdPartyRoomMessage(payload);
    });
  }
  getThirdPartyUserDataById(id) {
    let raw = b2a(id);
    return Promise.resolve(this.getThirdPartyUserDataById_noPromise(raw));
  }
  getThirdPartyRoomDataById(id) {
    let raw = b2a(id);
    let payload = {};
    let contact = this.client.getContact(raw);
    if (contact) {
      return Promise.resolve({
        name: deskypeify(contact.name.displayName),
        topic: "Skype Direct Message"
      });
    }
    return new Promise((resolve, reject) => {
      this.client.getConversation(raw).then((res) => {
        resolve({
          name: deskypeify(res.threadProperties.topic),
          topic: res.type.toLowerCase() == "conversation" ? "Skype Direct Message" : "Skype Group Chat"
        });
      }).catch((err) => {
        reject(err);
      });
    });
  }
  sendReadReceiptAsPuppetToThirdPartyRoomWithId() {
    // no-op for now
  }
  sendMessageAsPuppetToThirdPartyRoomWithId(id, text) {
    return this.client.sendMessage(b2a(id), {
      textContent: skypeify(text)
    });
  }
  sendImageMessageAsPuppetToThirdPartyRoomWithId(id, data) {
    let cleanup = () => {};
    return new Promise((resolve, reject) => {
      tmp.file((err, path, fd, cleanupCallback) => {
        cleanup = cleanupCallback;
        let tmpFile = fs.createWriteStream(path);
        //let handler;
        download.getBufferAndType(data.url).then(({ buffer, type }) => {
          tmpFile.write(buffer, (err) => {
            if (err) {
              reject(err);
              return;
            }
            tmpFile.close(() => {
              resolve(this.client.sendPictureMessage(b2a(id), {
                file: path,
                name: data.text,
                url: data.url
              }));
            });
          });
        });
      });
    }).finally(() => {
      cleanup();
    });
  }
}

new Cli({
  port: config.port,
  registrationPath: config.registrationPath,
  generateRegistration: function(reg, callback) {
    puppet.associate().then(()=>{
      reg.setId(AppServiceRegistration.generateToken());
      reg.setHomeserverToken(AppServiceRegistration.generateToken());
      reg.setAppServiceToken(AppServiceRegistration.generateToken());
      reg.setSenderLocalpart("skypebot");
      reg.addRegexPattern("users", "@skype_.*", true);
      callback(reg);
    }).catch(err=>{
      console.error(err.message);
      process.exit(-1);
    });
  },
  run: function(port) {
    const app = new App(config, puppet);
    console.log('starting matrix client');
    return puppet.startClient().then(()=>{
      console.log('starting skype client');
      return app.initThirdPartyClient();
    }).then(()=>{
      return app.bridge.run(port, config);
    }).then(()=>{
      console.log('Matrix-side listening on port %s', port);
    }).catch(err=>{
      console.error(err.message);
      process.exit(-1);
    });
  }
}).run();
