var fs = require('fs');
var events = require('events');
var util = require('util');
var sqlite3 = require('sqlite3');
var tmp = require('tmp');

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

Library.prototype._tmp = function (done) {
	var that = this;
	tmp.file(function (err, tmppath, fd) {
		if (!err) {
			that.path = tmppath;
		}
		done(err, tmppath, fd);
	});
};

Library.prototype.open = function (buf, done) {
	var that = this;
	done = done || function () {};

	this._tmp(function (err, tmppath, fd) {
		if (err) return done(err);
		fs.writeFile(that.path, buf, function (err) {
			if (err) return done(err);
			that.db = new sqlite3.Database(that.path);
			that.emit('ready');
		});
	});
};

Library.prototype.create = function (done) {
	var that = this;
	done = done || function () {};

	var fields = [
		'title TEXT',
		'album TEXT',
		'artist TEXT',
		'albumartist TEXT',
		'composer TEXT',
		'track INT',
		'disc INT',
		'year INT',
		'genre TEXT',
		'length INT',
		'filename TEXT',
		'filesize INT',
		'art_automatic TEXT',
		'art_manual TEXT',
		'rating INT',
		'unavailable INT'
	];

	this._tmp(function (err, tmppath, fd) {
		if (err) return done(err);
		that.db = new sqlite3.Database(that.path);
		that.db.serialize(function () {
			that.db.run('CREATE TABLE songs ('+fields.join(', ')+')');
			that.emit('ready');
		});
	});
};

Library.prototype.addSong = function (song, done) {
	var that = this;
	done = done || function () {};

	this.db.serialize(function () {
		var stmt = that.db.prepare('INSERT INTO songs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'); // TODO: more fields
		stmt.run(
		song.title,
		song.album,
		song.artist,
		song.albumartist,
		song.composer,
		song.track,
		song.disk,
		song.year,
		song.genre,
		song.length,
		song.filename,
		null,
		null,
		song.filesize,
		song.rating,
		0,
		function (err) {
			if (err) return done(err);
			that.emit('song', song);
			done();
		});
	});
};

Library.prototype.export = function () {
	return fs.createReadStream(this.path);
};

Library.prototype.close = function () {
	this.db.close();
};

module.exports = Library;