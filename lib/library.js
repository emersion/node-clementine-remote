var fs = require('fs');
var events = require('events');
var util = require('util');
var sqlite3 = require('sqlite3');
var tmp = require('tmp');

function Library(buf) {
	if (!(this instanceof Library)) return new Library(buf);
	events.EventEmitter.call(this);

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

	tmp.file(function (err, tmppath, fd) {
		if (err) return done('Could not open tmp database');
		fs.writeFile(tmppath, buf, function (err) {
			if (err) return done('Could not write tmp database');
			console.log('Written:', tmppath);
			that.db = new sqlite3.Database(tmppath);
			that.emit('ready');
		});
	});
};

Library.prototype.create = function (done) {
	var that = this;
	done = done || function () {};

	this.db = new sqlite3.Database(':memory:');
	db.serialize(function () {
		db.run('CREATE TABLE songs (title TEXT, album TEXT, artist TEXT, albumartist TEXT, track INT, disc INT, year INT, genre TEXT, length INT, filename TEXT, filesize INT, rating INT)');
		that.emit('ready');
	});
};

Library.prototype.addSong = function (song) { /* TODO */ };

Library.prototype.close = function () {
	this.db.close();
};

module.exports = Library;