'use strict';

var lodash = require('lodash');

function translateHandlebars(template, gttext, lang, catalog, cb) {

    function gettext(key) {
      var msg = key || {};
      return (msg.msgstr && msg.msgstr[0]) || '';
    }

    var i=0;
    var catalogKeyLength = lodash.keys(catalog).length;
    lodash.forEach(catalog, function(key, value) {
        i = i + 1;
        if (i===catalogKeyLength) {
          cb(template);
        }
        var text = gettext(key);
        if (!value || typeof value !== 'string' || value===text) {
          return;
        }
        //var re = new RegExp('>\\s*(' + lodash.escapeRegExp(value)  + ')\\s*<');
        value = lodash.escapeRegExp(value);
        value = lodash.replace(value, /([\s\n\t])/g, '([\\s\\n\\t]*)');
        var re = new RegExp('["\\\\\'\'/>]\\s*(' + value  + ')\\s*["\\\'\\\'/<]');
        var needle, match;
        match = re.exec(template);

        while (match) {
          needle = match[0];
          template = template.replace(needle, needle[0] + text + needle[needle.length-1]);
          match = re.exec(template);
        }

    });

}

module.exports = translateHandlebars;
