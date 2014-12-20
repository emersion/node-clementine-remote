var events = require('events');
var util = require('util');
var SQL = require('./sql');

function Library(buf) {
	if (!(this instanceof Library)) return new Library(buf);
	events.EventEmitter.call(this);

	this.path = '';
	this.db = new SQL.Database();
	this.opened = false;

	if (buf) {
		this.open(buf);
	} else {
		this.create();
	}
}
util.inherits(Library, events.EventEmitter);

Library.prototype.open = function (buf, done) {
	var that = this;
	done = done || function () {};

	var uints = new Uint8Array(buf);
	this.db.open(uints, function () {
		that.opened = true;
		that.emit('ready');
		done();
	});
};

Library.prototype.create = function (done) {
	var that = this;
	done = done || function () {};

	process.nextTick(function () {
		that.opened = true;
		that.emit('ready');
		done();
	});
};

Library.prototype.addSong = function (song, done) {
	var that = this;
	done = done || function () {};

	process.nextTick(function () {
		that.emit('song', song);
		done();
	});
};

Library.prototype.export = function (done) {
	return this.db.export(done);
};

Library.prototype.saveToCache = function (done) {
	return this.db.saveToCache('library', done);
};

Library.prototype.openFromCache = function (done) {
	return this.db.openFromCache('library', done);
};

Library.prototype.isCached = function () {
	return this.db.isCached('library');
};

Library.prototype.close = function () {
	this.db.close();
	this.db = null;
	this.opened = false;
};

module.exports = Library;