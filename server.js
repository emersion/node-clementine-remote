var net = require('net');
var events = require('events');
var stream = require('stream');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message,
	MsgType = proto.MsgType;

function Connection(socket, server) {
	if (!(this instanceof Connection)) return new Connection(socket, server);
	stream.Duplex.call(this);

	var that = this;

	this.socket = socket;
	this.server = server;

	this.accepted = false;

	var buf;
	socket.on('data', function (data) {
		// TODO: better buffering
		if (buf) {
			data = Buffer.concat([buf || new Buffer(), data]);
		}
		var len = data.readUInt32BE(0);

		// Receiving more than 128mb is very unlikely
		if (len > 134217728) {
			console.warn('WARN: invalid message length, too big', len, data.length, data);
			that.end();
			return;
		}
		if (len > data.length) { // We didn't get everything
			buf = data;
			return;
		}
		buf = null;

		var msg = proto.decode(data);
		if (!msg) {
			console.log('WARN: could not decode data');
			return;
		}

		that.emit('message', msg);
		//console.log(msg);

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
				console.log('client accepted');

				that.version = msg.version; // Set protocol version

				that.write({
					type: 'FIRST_DATA_SENT_COMPLETE',
					response_clementine_info: {
						version: that.server.version,
						state: proto.EngineState[that.server.state]
					},
					repeat: { repeat_mode: 0 },
					shuffle: { shuffle_mode: 0 }
				});
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
			default:
				console.warn('WARN: unsupported message type', msg);
		}
	});

	socket.on('end', function () {
		console.log('client disconnected');
		that.emit('end');
	});

	// TODO: send KEEP_ALIVE
}
util.inherits(Connection, stream.Duplex);

Connection.prototype.write = function (msgData) {
	if (this.version && this.version <= 12) {
		msgData.version = 13;
	}

	this.socket.write(proto.encode(msgData));
};

Connection.prototype.end = function () {
	console.log('disconnecting client');
	this.socket.end();
};

function Server(opts) {
	if (!(this instanceof Server)) return new Server(opts);
	events.EventEmitter.call(this);

	this.options = opts;
	this.conns = [];

	this.version = 'Clementine 1.2.3 Node.js server';
	this.state = 'Idle';

	var that = this;

	var server = net.createServer(function (socket) {
		console.log('client connected');

		var conn = Connection(socket, that);
		that.conns.push(conn);

		conn.on('end', function () {
			var index = that.conns.indexOf(conn);
			if (~index) {
				that.conns.splice(index, 1);
			}
		});

		that.emit('connection', conn);
	});
	server.listen(opts.port || 5500, function () {
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

var actions = ['play', 'playpause', 'pause', 'stop', 'next', 'previous', 'shuffle_playlist'];
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