'use strict';

var fs = require('fs');
var gutil = require('gulp-util');
var lodash = require('lodash');
var path = require('path');
var through = require('through2');
var gettextParser = require('gettext-parser');

var TranslatedFile = require('./translated-file');
var PluginError = gutil.PluginError;



function Translator(options) {
  this.options = lodash.defaults(options, {
      localeDirs: ['locale'],
      defaultLang: 'fa'
  });
  this.translators = {};
  return this;
}


Translator.prototype.getLocales = function() {
  if (this._locales && this._locales.length > 0) {
    return this._locales;
  }
  // the first locale directory is the canonical list of languages
  var localeDir = this.options.localeDirs[0];
  var isLocale = function(file) {
    var filePath = path.join(localeDir, file);
    return (! file.match(/template/)) && fs.statSync(filePath).isDirectory();
  };
  this._locales = lodash.filter(fs.readdirSync(localeDir), isLocale);
  this._locales.push(this.options.defaultLang);
  return this._locales;
};

var getPoParser = function(lang) {
  var parser = function(localeDir) {
    var fp = path.join(localeDir, lang, 'LC_MESSAGES', 'messages.po');
    var hasPo = fs.existsSync(fp);
    var po = hasPo ? fs.readFileSync(fp, {encoding: 'utf8'}) : null;
    var catalog = po ? gettextParser.po.parse(po).translations[''] : {};
    return catalog;
  };
  return parser;
};

var getCatalogParser = function(defaultLang, localeDirs) {
  var parser = function(lang) {
    var parsePo = getPoParser(lang);
    var jsonPoArray = lodash.map(localeDirs, parsePo);
    return lodash.reduce(jsonPoArray, lodash.defaults);
  };
  return parser;
};

Translator.prototype.getCatalogs = function() {
  if(this._catalogs) {
    return this._catalogs;
  }
  var parseCatalog = getCatalogParser(
    this.options.defaultLang,
    this.options.localeDirs
  );
  var locales = this.getLocales();
  var catalogList = lodash.map(locales, parseCatalog, this);

  this._catalogs = lodash.zipObject(locales, catalogList);
  return this._catalogs;
};


Translator.prototype.getCatalog = function(lang) {
  var catalogs = this.getCatalogs();
  var cat = catalogs[lang];
  if (!cat) {
    this.error('Unable find a translation catalog for ' + lang);
  }
  return cat;
};


Translator.prototype.langGettext = function(lang, str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  var catalog = this.getCatalog(lang);
  var msg = catalog[str] || {};
  return (msg.msgstr && msg.msgstr[0]) || str;
};


Translator.prototype.error = function(msg) {
  var id = 'gulp-static-i18n/lib/Translator';
  if (this.stream) {
    this.stream.emit('error', new PluginError(id, msg));
  } else {
    throw new Error(msg);
  }
};


Translator.prototype.readFile = function(file) {
  if(!file || !file.contents) {
    this.error('No file found.');
  }
  return String(file.contents);
};


Translator.prototype.register = function(fileExts, translator) {
  var self = this;
  var regExt = function(ext) {
    self.translators[ext] = translator;
  };
  lodash.forEach(fileExts, regExt, this);
};


Translator.prototype.getTranslator = function(file) {
  var ext = path.extname(file.path);
  var nullTranslator = function() { return null; };
  return this.translators[ext] || nullTranslator;
};

Translator.prototype.translate = function(file) {
  var translator = this.getTranslator(file);
  var copy = this.readFile(file);
  var locales = this.getLocales();
  var opts = this.options;
  opts.file = file;
  var self = this;
  var translateFile = function(lang) {
    var gettext = lodash.bind(self.langGettext, self, lang);
    lang = lang.toLowerCase().replace(/_/g, '-');
    opts.lang = lang;
    var ext = path.extname(file.path);
    if (ext=='.js' || ext=='.html' || ext=='.css') { 
        translator(copy, gettext, lang, self.getCatalog(lang), function(translatedContent) {
            opts.translation = translatedContent;
            var translatedFile = new TranslatedFile(opts);
            self.stream.push(translatedFile);
        }.bind(self));
    } else {
        opts.translation = translator(copy, gettext, lang);
        var translatedFile = new TranslatedFile(opts);
        self.stream.push(translatedFile);
    }
  };

  lodash.forEach(locales, translateFile, this);
  
  setTimeout(function() {
      self.stream.emit('translated', file);}, 2000);
};


Translator.prototype.getStreamTranslator = function() {
  var translator = this;
  return through.obj(function(file, encoding, cb) {
    translator.stream = this;
    translator.translate(file);
    cb();
  });
};


module.exports = Translator;
