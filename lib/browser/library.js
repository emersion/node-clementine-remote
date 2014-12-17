var events = require('events');
var util = require('util');

// TODO: use sql.js
// https://github.com/kripken/sql.js/

function Library(buf) {
	if (!(this instanceof Library)) return new Library(buf);
	events.EventEmitter.call(this);

	this.path = '';
	this.db = null;

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

	process.nextTick(function () {
		that.emit('ready');
		done();
	});
};

Library.prototype.create = function (done) {
	var that = this;
	done = done || function () {};

	process.nextTick(function () {
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

Library.prototype.export = function () {
	return null;
};

Library.prototype.close = function () {};

module.exports = Library;