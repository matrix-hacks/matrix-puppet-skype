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
        from: { raw },
        conversation, content
      } = data;

      this.handleSkypeMessage({
        roomId: a2b(conversation),
        senderId: a2b(raw)
      }, content);
    });

    this.client.on('sent', (data) => {
      debug('sent', data);
      const { conversation, content } = data;

      this.handleSkypeMessage({
        roomId: a2b(conversation),
        senderId: undefined
      }, content);
    });

    return this.client.connect();
  }
  handleSkypeMessage(payload, message) {
    payload.text = message;
    payload.roomId.replace(':', '^');
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
      textContent: text
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
