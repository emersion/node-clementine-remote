var net = require('net');
var stream = require('stream');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message,
	MsgType = proto.MsgType;

function ClementineClient(opts) {
	if (!(this instanceof ClementineClient)) return new ClementineClient(opts);
	stream.Duplex.call(this);

	var that = this;

	this.socket = net.connect({
		host: opts.host,
		port: opts.port
	});

	this.socket.on('connect', function () {
		var req = {
			send_playlist_songs: true,
			downloader: false
		};
		if (typeof opts.auth_code == 'number') {
			req.auth_code = opts.auth_code;
		}
		that.write({
			type: 'CONNECT',
			version: 12,
			request_connect: req
		});

		that.emit('connect');
	});

	this.socket.on('data', function (buf) {
		// TODO: data buffering
		var msg = proto.decode(buf);
		if (!msg) {
			console.log('WARN: could not decode data');
			return;
		}

		if (msg.repeat) {
			that.repeat = msg.repeat;
			that.emit('repeat', that.repeat);
		}
		if (msg.shuffle) {
			that.shuffle = msg.shuffle;
			that.emit('shuffle', that.shuffle);
		}
		if (msg.response_playlists) { //TODO
			that.playlist = msg.response_playlists.playlist;
			that.emit('playlist', that.playlist);
		}

		that.emit('message', msg);

		switch (msg.type) {
			case MsgType.DISCONNECT:
				that.emit('disconnect', msg.response_disconnect);
				break;
			case MsgType.SET_VOLUME:
				that.volume = msg.request_set_volume.volume;
				that.emit('volume', that.volume);
				break;
			case MsgType.KEEP_ALIVE:
				that.emit('alive');
				break;
			case MsgType.FIRST_DATA_SENT_COMPLETE:
				that.info = msg.response_clementine_info;
				that.emit('ready');
				break;
			case MsgType.ACTIVE_PLAYLIST_CHANGED:
				that.playlist_id = msg.response_active_changed.id;
				that.playlist = msg.response_playlist_songs.requested_playlist;
				that.songs = msg.response_playlist_songs.songs;
				that.emit('playlist');
				break;
			case MsgType.CURRENT_METAINFO:
				that.song = msg.response_current_metadata.song_metadata;
				that.emit('song', that.song);
				break;
			case MsgType.UPDATE_TRACK_POSITION:
				that.track = msg.response_update_track_position;
				that.emit('track', that.track);
				break;
			case MsgType.PLAY:
			case MsgType.PLAYPAUSE:
			case MsgType.PAUSE:
			case MsgType.STOP:
			case MsgType.NEXT:
			case MsgType.PREVIOUS:
				that.emit(proto.getMsgTypeName(msg.type).toLowerCase());
				break;
			default:
				console.log('Unhandled message type', msg.type, msg);
				that.emit(proto.getMsgTypeName(msg.type).toLowerCase(), msg);
		}
	});

	this.socket.on('end', function () {
		that.emit('end');
	});
}
util.inherits(ClementineClient, stream.Duplex);

ClementineClient.prototype.write = function (msgData) {
	this.socket.write(proto.encode(msgData));
};

var actions = ['play', 'playpause', 'pause', 'stop', 'next', 'previous', 'shuffle_playlist', 'disconnect'];
function setAction(name) {
	ClementineClient.prototype[name] = function () {
		this.write({
			type: name.toUpperCase()
		});
	};
}
for (var i = 0; i < actions.length; i++) {
	setAction(actions[i]);
}

ClementineClient.prototype.end = function () {
	return this.disconnect();
};

module.exports = ClementineClient;