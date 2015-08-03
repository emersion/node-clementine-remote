var fs = require('fs');
var events = require('events');
var util = require('util');
var sqlite3 = require('sqlite3');
var tmp = require('tmp');

function Library(buf, done) {
	if (!(this instanceof Library)) return new Library(buf);
	events.EventEmitter.call(this);

	this.path = '';
	this.db = null;

	var that = this;

	var callback = function (err) {
		if (err) {
			console.error('ERR: could not initialize library db', err);
		} else {
			that.emit('ready');
		}

		if (done) {
			done(err);
		}
	};

	if (buf) {
		this.open(buf, callback);
	} else {
		this.create(callback);
	}
}
util.inherits(Library, events.EventEmitter);

Library.prototype._tmp = function (done) {
	var that = this;

	tmp.file(function (err, tmppath) {
		if (err) return done(err);

		that.path = tmppath;
		done(null);
	});
};

Library.prototype.open = function (buf, done) {
	var that = this;
	done = done || function () {};

	this._tmp(function (err) {
		if (err) return done(err);
		fs.writeFile(that.path, buf, function (err) {
			if (err) return done(err);
			that.db = new sqlite3.Database(that.path);
			done(null);
		});
	});
};

Library.prototype.create = function (done) {
	var that = this;
	done = done || function () {};

	var fields = [
		'title TEXT NOT NULL',
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

	this._tmp(function (err) {
		if (err) return done(err);
		that.db = new sqlite3.Database(that.path);
		that.db.serialize(function () {
			that.db.run('CREATE TABLE songs ('+fields.join(', ')+')');
			done(null);
		});
	});
};

Library.prototype.addSong = function (song, done) {
	var that = this;
	done = done || function () {};

	this.db.serialize(function () {
		var stmt = that.db.prepare('INSERT INTO songs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'); // TODO: more fields
		stmt.run(
		song.title, // Must not be null (Android app crashes)
		song.album,
		song.artist,
		song.albumartist,
		song.composer,
		song.track,
		song.disk,
		song.year,
		song.genre,
		song.length,
		song.filename, // Must not be null (Android app crashes)
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

Library.prototype.reset = function (done) {
	var that = this;
	done = done || function () {};

	this.db.serialize(function () {
		that.db.run('DELETE FROM songs');
		done(null);
	});
};

Library.prototype.export = function () {
	return fs.createReadStream(this.path);
};

Library.prototype.close = function () {
	this.db.close();
};

module.exports = Library;