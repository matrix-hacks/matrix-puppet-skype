const striptags = require("striptags");
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const skypeify = function (s) {
  console.log(s);
  s = entities.encode(s);
  s = entities.encode(s); // skype is weird as hell
  // url regex from https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
  s = s.replace(/(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}[-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi, function (match, href) {
    // we decode here because we encoded twice above --> it will be encoded once
    return '<a href="' + entities.decode(href) + '">' + href + '</a>';
  });
  console.log(s);
  return s;
}
const deskypeify = function (s) {
  let edit = s.match(/<e_m[^>]*>\s*$/i) !== null || s.match(/<e_m[^>]*>\s*<[^>]*e_m[^>]*>\s*$/i) !== null;
  s = striptags(s);
  s = entities.decode(s);
  if (edit) {
    s = '[edit] ' + s;
  }
  return s;
}

module.exports = { skypeify, deskypeify };
