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
  getPayload(data) {
    let payload = {
      roomId: data.roomId.replace(':', '^'),
      senderId: undefined,
      senderName: this.client.getContactName(data.sender)
    };
    if (data.sender === undefined) {
      payload.senderId = undefined;
    } else {
      payload.senderId = a2b(data.sender);
    }
    return payload;
  }
  handleSkypeMessage(data) {
    let payload = this.getPayload(data);
    payload.text = deskypeify(data.content);
    return this.handleThirdPartyRoomMessage(payload);
  }
  handleSkypeImage(data) {
    let payload = this.getPayload(data);
    payload.text = '[Image] ('+data.name+') '+data.url;
    return this.handleThirdPartyRoomMessage(payload);
  }
  getThirdPartyUserDataById(id) {
    let raw = b2a(id);
    let name = this.client.getContactName(raw) || raw;
    return Promise.resolve({
      senderName: name
    })
  }
  getThirdPartyRoomDataById(id) {
    let raw = b2a(id);
    let name = this.client.getContactName(raw) || raw;
    return Promise.resolve({
      name: name,
      topic: "Skype Direct Message"
    })
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
    console.log(data);
    return this.client.sendPictureMessage(b2a(id), {
      url: data.url,
      name: data.text
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
