var events = require('events');
var util = require('util');

function Playlist(name) {
	if (!(this instanceof Playlist)) return new Playlist(name);
	events.EventEmitter.call(this);

	this.name = name || '';
	this.songs = [];
}
util.inherits(Playlist, events.EventEmitter);

Playlist.prototype.addSong = function (song) {
	this.songs.push(song);
	this.emit('update');
};
Playlist.prototype.removeSong = function (song) {
	var index = this.songs.indexOf(song);
	if (index >= 0) {
		this.songs = this.songs.slice(index, 1);
		this.emit('update');
	}
};
Playlist.prototype.setSongs = function (songs) {
	this.songs = songs;
	this.emit('update');
};

module.exports = Playlist;