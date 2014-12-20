var net = require('net');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message,
	MsgType = proto.MsgType;
var Connection = require('./connection');
var Library = require('./library');
var MessageBuilder = require('./messagebuilder');
var utils = require('./utils');

function Client(opts) {
	if (!(this instanceof Client)) return new Client(opts);

	var socket = net.connect({
		host: opts.host,
		port: opts.port
	});
	Connection.call(this, socket);

	var that = this;

	this.library = Library();
	this.builder = MessageBuilder(this);

	socket.on('connect', function () {
		var req = {
			send_playlist_songs: true,
			downloader: false
		};
		if (typeof opts.auth_code == 'number') {
			req.auth_code = opts.auth_code;
		}
		that.write({
			type: 'CONNECT',
			request_connect: req
		});

		that.emit('connect');
	});

	this.on('message', function (msg) {
		switch (msg.type) {
			case MsgType.DISCONNECT:
				that.emit('disconnect', msg.response_disconnect);
				break;
			case MsgType.SET_VOLUME:
				that.volume = msg.request_set_volume.volume;
				that.emit('volume', that.volume);
				break;
			case MsgType.PLAY:
			case MsgType.PLAYPAUSE:
			case MsgType.PAUSE:
			case MsgType.STOP:
			case MsgType.NEXT:
			case MsgType.PREVIOUS:
				that.emit(proto.getMsgTypeName(msg.type).toLowerCase());
				break;
			case MsgType.REPEAT:
				that.repeat = msg.repeat.repeat_mode;
				that.emit('repeat', that.repeat);
				break;
			case MsgType.SHUFFLE:
				that.shuffle = msg.shuffle.shuffle_mode;
				that.emit('shuffle', that.shuffle);
				break;
			case MsgType.INFO:
				that.version = msg.response_clementine_info.version;
				that.state = proto.getEngineStateName(msg.response_clementine_info.state);
				if (that.state == 'Playing') {
					that.emit('play');
				}
				break;
			case MsgType.CURRENT_METAINFO:
				that.song = msg.response_current_metadata.song_metadata;
				that.emit('song', that.song);
				break;
			case MsgType.PLAYLISTS:
				that.playlistsList = msg.response_playlists.playlist;
				that.emit('playlists', that.playlistsList);
				break;
			case MsgType.PLAYLIST_SONGS:
				that.playlist = msg.response_playlist_songs.requested_playlist;
				that.songs = msg.response_playlist_songs.songs;
				break;
			case MsgType.KEEP_ALIVE:
				that.emit('alive');
				break;
			case MsgType.UPDATE_TRACK_POSITION:
				that.position = msg.response_update_track_position.position;
				that.emit('position', that.position);
				break;
			case MsgType.ACTIVE_PLAYLIST_CHANGED:
				that.playlist_id = msg.response_active_changed.id;
				break;
			case MsgType.FIRST_DATA_SENT_COMPLETE:
				that.emit('ready');
				break;
			case MsgType.LIBRARY_CHUNK:
				var res = msg.response_library_chunk;

				if (!that.libraryChunks) { // First chunk received, create a new array
					that.libraryChunks = [];
					for (var i = 0; i < res.chunk_count; i++) {
						that.libraryChunks.push(null);
					}
				}

				// Chunk received, add it to the array
				var buf = utils.bytebufferToBuffer(res.data);
				that.libraryChunks[res.chunk_number - 1] = buf;

				if (!~that.libraryChunks.indexOf(null)) { // All chunks were received
					var db = Buffer.concat(that.libraryChunks);
					that.libraryChunks = null;
					that.library.open(db, function () {
						that.emit('library', that.library);
					});
				}
				break;
			default:
				console.log('Unhandled message type', msg.type, msg);
				that.emit(proto.getMsgTypeName(msg.type).toLowerCase(), msg);
		}
	});
}
util.inherits(Client, Connection);

var actions = ['play', 'playpause', 'pause', 'stop', 'next', 'previous', 'shuffle_playlist', 'disconnect', 'get_library'];
function setAction(name) {
	Client.prototype[name] = function () {
		this.write({
			type: name.toUpperCase()
		});
	};
}
for (var i = 0; i < actions.length; i++) {
	setAction(actions[i]);
}

Client.prototype.change_song = function (playlist, song) {
	this.write(this.builder.change_song(playlist, song));
};

Client.prototype.insert_urls = function () {
	this.write(this.builder.insert_urls.apply(this.builder, arguments));
};

Client.prototype.end = function () {
	return this.disconnect();
};

module.exports = Client;