var net = require('net');
var events = require('events');
var stream = require('stream');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message,
	MsgType = proto.MsgType;
var Connection = require('./connection');

function ServerConnection(socket, server) {
	if (!(this instanceof ServerConnection)) return new ServerConnection(socket, server);
	Connection.call(this, socket);

	var that = this;

	this.server = server;

	this.accepted = false;

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

	opts.port = opts.port || 5500;
	opts.keepAliveInterval = opts.keepAliveInterval || 10;

	this.options = opts;
	this.conns = [];

	this.version = 'Clementine 1.2.3 Node.js server';
	this.state = 'Idle';

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