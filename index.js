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

class App extends MatrixPuppetBridgeBase {
  getServicePrefix() {
    return "skype";
  }
  getServiceName() {
    return "Skype";
  }
  initThirdPartyClient() {
    this.client = new SkypeClient("matrix");


    // Log every event
    api.on("event", (ev: events.EventMessage) => {
      console.log(JSON.stringify(ev, null, 2));
    });

    // Log every error
    api.on("error", (err: Error) => {
      console.error("An error was detected:");
      console.error(err);
    });


    this.client.on('message', (ev) => {
      const { source, message } = ev.data;
      this.handleSkypeMessage({
        roomId: source,
        senderId: source,
        senderName: source,
      }, message);
    });

    this.client.on('sent', (ev) => {
      const { destination, message } = ev.data;
      this.handleSkypeMessage({
        roomId: destination,
        senderId: undefined,
        senderName: destination,
      }, message);
    });

    return this.client.start();
  }
  handleSkypeMessage(payload, message) {
    if ( message.body ) {
      payload.text = message.body
    }
    if ( message.attachments.length === 0 ) {
      return this.handleThirdPartyRoomMessage(payload);
    } else {
      // TODO handle array of attachments!
      // XXX only takes first one now.
      let att = message.attachments[0];
      payload.buffer = new Buffer(att.data);
      payload.mimetype = att.contentType;
      if ( message.attachments.length > 1 ) {
        this.sendStatusMsg({}, "dont know how to handle more than one attachment! ignored all but the first one.");
      }
      if ( payload.mimetype.match(/^image/) ) {
        return this.handleThirdPartyRoomImageMessage(payload);
      } else {
        return this.sendStatusMsg({}, "dont know how to deal with filetype", payload);
      }
    }
  }
  getThirdPartyRoomDataById(phoneNumber) {
    return Promise.resolve({
      name: '',
      topic: "Skype Direct Message"
    })
  }
  sendReadReceiptAsPuppetToThirdPartyRoomWithId() {
    // no-op for now
  }
  sendMessageAsPuppetToThirdPartyRoomWithId(id, text) {
    return this.client.sendMessage(id, text);
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
