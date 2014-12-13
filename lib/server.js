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
			console.warn('WARN: unknown message type');
			return;
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
				console.log(req);
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
				console.log('client accepted');

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
				break;
			case MsgType.REQUEST_PLAYLISTS:
				that.write(builder.playlists());
				break;
			case MsgType.REQUEST_PLAYLIST_SONGS:
				that.write(builder.playlist_songs(server.playlist)); //TODO: support multiple playlists
				break;
			case MsgType.SET_VOLUME:
				//that.server.volume = msg.request_set_volume.volume;
				that.server.emit('volume', that.server.volume);
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
				that.server.emit(proto.getMsgTypeName(msg.type).toLowerCase());
				break;
			case MsgType.REPEAT:
				//that.server.repeat = msg.repeat.repeat_mode;
				that.server.emit('repeat', that.server.repeat);
				break;
			case MsgType.SHUFFLE:
				//that.server.shuffle = msg.shuffle.shuffle_mode;
				that.server.emit('shuffle', that.server.shuffle);
				break;
			case MsgType.CHANGE_SONG:
			case MsgType.SET_TRACK_POSITION:
			case MsgType.REMOVE_SONGS:
			case MsgType.OPEN_PLAYLIST:
			case MsgType.CLOSE_PLAYLIST:
			case MsgType.GET_LYRICS:
			case MsgType.DOWNLOAD_SONGS:
			case MsgType.SONG_OFFER_RESPONSE:
			case MsgType.RATE_SONG:
			case MsgType.GLOBAL_SEARCH:
			case MsgType.STOP_AFTER:
			case MsgType.GET_LIBRARY:
			case MsgType.RATE_SONG:
			case MsgType.GLOBAL_SEARCH:
			case MsgType.SHUFFLE_PLAYLIST:
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
		console.log('client disconnected');
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

	this.playlist = Playlist('Playlist');
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
			if (~index) {
				that.conns.splice(index, 1);
			}
		});

		that.emit('connection', conn);
	});
	server.listen(opts.port, function () {
		console.log('Server listening', server.address());

		that.emit('listening');
	});
	this.server = server;
}
util.inherits(Server, events.EventEmitter);

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