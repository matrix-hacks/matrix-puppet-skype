const striptags = require("striptags");
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();

const skypeify = function (s) {
  s = entities.encode(s);
  // url regex from https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
  s = s.replace(/(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}[-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi, function (match, href) {
    // stuff is already encoded here
    return '<a href="' + href + '">' + href + '</a>';
  });
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
