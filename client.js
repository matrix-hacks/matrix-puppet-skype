const fs = require('fs');
const skypeHttp = require('skype-http');

console.log(skypeHttp);

// look at
// https://github.com/ocilo/skype-http/blob/master/src/example/main.ts

if (!module.parent) {
  const config = require('./config.json');
  skypeHttp.connect({ state: apiContext, verbose: true }).then((api)=>{

  });
}
