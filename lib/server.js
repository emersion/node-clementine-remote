var net = require('net');
var events = require('events');
var stream = require('stream');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message,
	MsgType = proto.MsgType;
var Connection = require('./connection');
var MessageBuilder = require('./messagebuilder');
var Library = require('./library');
var Playlist = require('./playlist');
var startMdns = require('./mdns');

function ServerConnection(socket, server) {
	if (!(this instanceof ServerConnection)) return new ServerConnection(socket, server);
	Connection.call(this, socket);

	var that = this;
	var builder = server.builder;

	this.server = server;

	this.accepted = false;
	this.downloader = false;

	this.on('message', function (msg) {
		if (msg.type === MsgType.UNKNOWN) {
			return that.emit('error', new Error('Unknown message type'));
		}

		if (!that.accepted && msg.type !== MsgType.CONNECT) {
			that.write({
				type: 'DISCONNECT',
				response_disconnect: {
					reason_disconnect: proto.ReasonDisconnect.Not_Authenticated
				}
			});
			that.end();
			return;
		}

		switch (msg.type) {
			case MsgType.CONNECT:
				that.version = msg.version; // Set protocol version

				var req = msg.request_connect;
				if (server.options.auth_code) { //Check auth code
					if (req.auth_code !== server.options.auth_code) {
						that.write({
							type: 'DISCONNECT',
							response_disconnect: {
								reason_disconnect: proto.ReasonDisconnect.Wrong_Auth_Code
							}
						});
						that.end();
						return;
					}
				}

				// Client successfully connected
				that.accepted = true;
				this.downloader = req.downloader || false;

				that.write(builder.info());
				that.write(builder.current_metainfo());
				that.write(builder.set_volume());
				that.write(builder.update_track_position());
				that.write(builder.playlists());
				if (req.send_playlist_songs) {
					that.write(builder.playlist_songs(server.playlist));
				}
				that.write(builder.repeat());
				that.write(builder.shuffle());
				if (server.state == 'Playing') {
					that.write({
						type: 'PLAY'
					});
				}
				that.write(builder.first_data_sent_complete());

				that.server.emit('connected', that);
				break;
			case MsgType.REQUEST_PLAYLISTS:
				that.write(builder.playlists());
				break;
			case MsgType.REQUEST_PLAYLIST_SONGS:
				that.write(builder.playlist_songs(server.playlist)); //TODO: support multiple playlists
				break;
			case MsgType.SET_VOLUME:
				that.server.emit('volume', msg.request_set_volume.volume);
				break;
			case MsgType.INSERT_URLS:
				that.server.emit('insert_urls', msg.request_insert_urls);
				break;
			case MsgType.GET_LIBRARY:
				that.emit('get_library');
				if (that.server.library) { // If library is available
					var readable = that.server.library.export();
					var chunks = [], len = 0;
					readable.on('data', function (buf) {
						chunks.push(buf);
						len += buf.length;
					});
					readable.on('end', function () {
						chunks.forEach(function (chunk, i) {
							that.write(builder.library_chunk({
								chunk_number: i + 1,
								chunk_count: chunks.length,
								data: chunk,
								size: len,
								file_hash: ''
							}));
						});
					});
				}
				break;
			case MsgType.DISCONNECT:
				that.end();
				break;
			case MsgType.PLAY:
			case MsgType.PLAYPAUSE:
			case MsgType.PAUSE:
			case MsgType.STOP:
			case MsgType.NEXT:
			case MsgType.PREVIOUS:
			case MsgType.SHUFFLE_PLAYLIST:
			case MsgType.GET_LYRICS:
			case MsgType.SONG_OFFER_RESPONSE:
			case MsgType.STOP_AFTER:
				that.server.emit(proto.getMsgTypeName(msg.type).toLowerCase());
				break;
			case MsgType.REPEAT:
				that.server.emit('repeat', proto.getRepeatModeName(msg.repeat.repeat_mode));
				break;
			case MsgType.SHUFFLE:
				that.server.emit('shuffle', proto.getShuffleModeName(msg.shuffle.shuffle_mode));
				break;
			case MsgType.CHANGE_SONG:
				that.server.emit('change_song', msg.request_change_song);
				break;
			case MsgType.SET_TRACK_POSITION:
				that.server.emit('set_track_position', msg.request_set_track_position.position);
				break;
			case MsgType.REMOVE_SONGS:
				that.server.emit('remove_songs', msg.request_remove_songs);
				break;
			case MsgType.OPEN_PLAYLIST:
				that.server.emit('open_playlist', msg.request_open_playlist.playlist_id);
				break;
			case MsgType.CLOSE_PLAYLIST:
				that.server.emit('close_playlist', msg.request_close_playlist.playlist_id);
				break;
			case MsgType.DOWNLOAD_SONGS:
				var req = msg.request_download_songs;
				req.download_item = proto.getDownloadItemName(req.download_item);
				that.server.emit('download_songs', req);
				break;
			case MsgType.RATE_SONG:
				that.server.emit('rate_song', msg.request_rate_song.rating);
				break;
			case MsgType.GLOBAL_SEARCH:
				that.server.emit('global_search', msg.request_global_search.query);
				break;
			default:
				console.warn('WARN: unsupported message type', msg);
		}
	});

	this.keepAliveInterval = setInterval(function () {
		that.write({
			type: 'KEEP_ALIVE'
		});
	}, server.options.keepAliveInterval * 1000);

	this.on('end', function () {
		clearInterval(that.keepAliveInterval);

		that.server.emit('disconnected', that);
	});
}
util.inherits(ServerConnection, Connection);

ServerConnection.prototype.write = function (msg) {
	if (this.version && this.version <= 12) {
		msg.version = 13;
	}

	Connection.prototype.write.call(this, msg);
};

ServerConnection.prototype.end = function () {
	console.log('disconnecting client');
	Connection.prototype.end.call(this);
};

function Server(opts) {
	if (!(this instanceof Server)) return new Server(opts);
	events.EventEmitter.call(this);

	var that = this;

	opts.host = opts.host || '127.0.0.1';
	opts.port = opts.port || 5500;
	opts.keepAliveInterval = opts.keepAliveInterval || 10;

	this.options = opts;
	this.conns = [];

	this.version = 'Clementine 1.2.3 Node.js server';

	var props = {
		state: 'Idle',
		repeat: 'Off',
		shuffle: 'Off',
		volume: 100,
		position: 0,
		song: null
	};
	Object.defineProperties(this, {
		state: {
			get: function () {
				return props.state;
			},
			set: function (state) {
				props.state = state;
				that.broadcast({
					type: 'ENGINE_STATE_CHANGED',
					response_engine_state_changed: {
						state: state
					}
				});
			},
			enumerable: true
		},
		repeat: {
			get: function () {
				return props.repeat;
			},
			set: function (value) { // Off, Track, Album, Playlist
				props.repeat = value;
				that.broadcast(that.builder.repeat());
			},
			enumerable: true
		},
		shuffle: {
			get: function () {
				return props.shuffle;
			},
			set: function (value) { // Off, All, InsideAlbum, Albums
				props.shuffle = value;
				that.broadcast(that.builder.shuffle());
			},
			enumerable: true
		},
		volume: {
			get: function () {
				return props.volume;
			},
			set: function (value) { // value must be between 0 and 100
				props.volume = value;
				that.broadcast(that.builder.set_volume());
			},
			enumerable: true
		},
		position: {
			get: function () {
				return props.position;
			},
			set: function (pos) {
				props.position = pos;
				that.broadcast(that.builder.update_track_position());
			},
			enumerable: true
		},
		song: {
			get: function () {
				return props.song;
			},
			set: function (metadata) {
				props.song = metadata;
				that.broadcast(that.builder.current_metainfo());
			},
			enumerable: true
		}
	});

	this.builder = MessageBuilder(this);
	this.library = Library();

	this.playlist = Playlist('Now playing');
	this.playlist.on('update', function () {
		that.broadcast(that.builder.playlist_songs(that.playlist));
	});

	var that = this;

	var server = net.createServer(function (socket) {
		console.log('client connected');

		var conn = ServerConnection(socket, that);
		that.conns.push(conn);

		conn.on('end', function () {
			var index = that.conns.indexOf(conn);
			if (index >= 0) {
				that.conns.splice(index, 1);
			}
		});

		that.emit('connection', conn);
	});
	this.server = server;
}
util.inherits(Server, events.EventEmitter);

Server.prototype.listen = function (done) {
	var that = this;

	return this.server.listen(this.options.port, this.options.host, function () {
		if (done) {
			done();
		}

		that.emit('listening');
	});
};

Server.prototype.broadcast = function (msg) {
	for (var i = 0; i < this.conns.length; i++) {
		this.conns[i].write(msg);
	}
};

Server.prototype.play = function () {
	this.state = 'Playing';
	this.broadcast({
		type: 'PLAY'
	});
};
Server.prototype.pause = function () {
	this.state = 'Paused';
	this.broadcast({
		type: 'PAUSE'
	});
};
Server.prototype.stop = function () {
	this.state = 'Idle';
	this.broadcast({
		type: 'STOP'
	});
};

var actions = ['next', 'previous', 'shuffle_playlist'];
function setAction(name) {
	Server.prototype[name] = function () {
		this.broadcast({
			type: name.toUpperCase()
		});
	};
}
for (var i = 0; i < actions.length; i++) {
	setAction(actions[i]);
}

Server.prototype.address = function () {
	return this.server.address();
};

Server.prototype.mdns = function (done) {
	var that = this;

	return startMdns(this.address().port, function (err) {
		if (!err) that.emit('mdns');
		if (done) done(err);
	});
};

Server.prototype.close = function (done) {
	var that = this;

	this.broadcast({
		type: 'DISCONNECT',
		response_disconnect: {
			reason_disconnect: proto.ReasonDisconnect.Server_Shutdown
		}
	});

	for (var i = 0; i < this.conns.length; i++) {
		this.conns[i].end();
	}

	this.server.close(function () {
		that.emit('close');
		if (done) done();
	});
};

module.exports = Server;