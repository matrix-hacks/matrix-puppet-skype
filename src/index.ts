import {
  ThirdPartyAdapter,
  
  download, entities,
  
  ThirdPartyPayload, ThirdPartyMessagePayload, ThirdPartyImageMessagePayload,
  UserData, RoomData
} from 'matrix-puppet-bridge';


import { SkypeClient } from './client';
const path = require('path');
const debug = require('debug')('matrix-puppet:skype');
import { skypeify, deskypeify } from './skypeify';
const tmp = require('tmp');
const fs = require('fs');

export class Adapter extends ThirdPartyAdapter {
  public serviceName = 'Skype';
  private client: SkypeClient;
  startClient(): Promise<void> {
    this.client = new SkypeClient();
    this.client.configure(this.config);
    
    this.client.on('error', (err) => {
      this.base.sendStatusMsg({}, err);
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
        roomId: conversation,
        sender: raw,
        content: content
      });
    });
    
    this.client.on('sent', (data) => {
      debug('sent', data);
      const { type, conversation, content } = data;
      
      this.handleSkypeMessage({
        type: type,
        roomId: conversation,
        sender: undefined,
        content: content
      });
    })
    
    this.client.on('image', (data) => {
      const {
        type,
        from: { raw },
        conversation, uri, original_file_name
      } = data;
      this.handleSkypeImage({
        type: type,
        roomId: conversation,
        sender: raw,
        url: uri+'/views/imgpsh_fullsize',
        name: original_file_name
      });
    });
    
    return this.client.connect();
  }
  
  getThirdPartyUserDataById_noPromise(id: string): UserData {
    let contact = this.client.getContact(id);
    let payload = <UserData>{
      name: id
    };
    if (contact) {
      payload.name = contact.name.displayName;
      payload.avatarUrl = contact.avatarUrl;
    } else if (id.indexOf(":") != -1) {
      payload.name = id.substr(id.indexOf(":")+1);
      payload.avatarUrl = 'https://avatars.skype.com/v1/avatars/' + entities.encode(payload.name) + '/public?returnDefaultImage=false&cacheHeaders=true';
    }
    return payload;
  }
  
  getPayload(data): ThirdPartyPayload {
    let payload = <ThirdPartyPayload>{
      roomId: data.roomId,
      senderId: undefined,
    };
    
    if (data.sender !== undefined) {
      payload.senderId = data.sender;
      let user: UserData = this.getThirdPartyUserDataById_noPromise(data.sender);
      payload.senderName = user.name;
      payload.avatarUrl = user.avatarUrl;
    }
    console.log(payload);
    return payload;
  }
  
  handleSkypeMessage(data) {
    let payload = <ThirdPartyMessagePayload>this.getPayload(data);
    payload.text = deskypeify(data.content);
    return this.base.handleThirdPartyRoomMessage(payload);
  }
  
  handleSkypeImage(data) {
    let payload = <ThirdPartyImageMessagePayload>this.getPayload(data);
    payload.text = data.name;
    return this.client.downloadImage(data.url).then(({ buffer, type }) => {
      payload.buffer = buffer;
      payload.mimetype = type;
      return this.base.handleThirdPartyRoomImageMessage(payload);
    }).catch((err) => {
      console.log(err);
      payload.text = '[Image] ('+data.name+') '+data.url;
      return this.base.handleThirdPartyRoomMessage(payload);
    });
  }
  
  getUserData(id) {
    return Promise.resolve(this.getThirdPartyUserDataById_noPromise(id));
  }
  
  getRoomData(id: string): Promise<RoomData> {
    console.log('Fetching additional room data...');
    console.log(id);
    let payload = {};
    let contact = this.client.getContact(id);
    if (contact) {
      return Promise.resolve(<RoomData>{
        name: deskypeify(contact.name.displayName),
        topic: "Skype Direct Message",
        isDirect: true,
      });
    }
    return new Promise<RoomData>((resolve, reject) => {
      this.client.getConversation(id).then((res) => {
        let isDirect = res.type.toLowerCase() == "conversation";
        resolve({
          name: deskypeify(res.threadProperties.topic),
          topic: isDirect ? "Skype Direct Message" : "Skype Group Chat",
          isDirect,
        });
      }).catch((err) => {
        reject(err);
      });
    });
  }
  sendMessage(id, text) {
    return this.client.sendMessage(id, {
      textContent: skypeify(text)
    });
  }
  sendImageMessage(id, data) {
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
              resolve(this.client.sendPictureMessage(id, {
                file: path,
                name: data.text,
                url: data.url
              }));
            });
          });
        });
      });
    }).then(() => {
      cleanup();
    });
  }
}
