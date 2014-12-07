var fs = require('fs');
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
		that.write({
			type: 'CONNECT',
			request_connect: {
				auth_code: opts.auth_code || undefined,
				send_playlist_songs: false,
				downloader: false
			}
		});

		that.emit('connect');
	});

	this.socket.on('data', function (buf) {
		// TODO: veryyyy buggy
		var len = buf.readUInt32BE(0);
		var msg;
		try {
			msg = Message.decode(buf.slice(buf.length - len));
		} catch (e) {
			console.log('msg len:', len, 'buf:', buf.length, 'offset:', buf.length - len);
			console.log('WARN: could not decode, trying to guess offset');
			for (var i = 0; i < buf.length; i++) {
				try {
					msg = Message.decode(buf.slice(i));
				} catch (e) {
					continue;
				}
				break;
			}
			console.log('WARN: Found offset', i);
		}

		if (msg.request_set_volume) {
			that.volume = msg.request_set_volume.volume;
			that.emit('volume', that.volume);
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
	var msg = new Message(msgData);
	var bufferData = msg.encode().toBuffer();

	var bufferHeader = new Buffer(4);
	bufferHeader.writeUInt32BE(bufferData.length, 0);

	var buf = Buffer.concat([bufferHeader, bufferData]);
	console.log('sending', buf.length, buf);
	this.socket.write(buf);
};

ClementineClient.prototype.prompt = function (msgData, resType, callback) {
	this.write(msgData);
	this.once(resType, callback);
};

var actions = ['play', 'playpause', 'pause', 'stop', 'next', 'previous', 'shuffle_playlist'];
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
	return that.disconnect();
};

exports.Client = ClementineClient;