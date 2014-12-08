var net = require('net');
var events = require('events');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message,
	MsgType = proto.MsgType;

function ClementineServer(opts) {
	if (!(this instanceof ClementineServer)) return new ClementineServer(opts);
	events.EventEmitter.call(this);

	var that = this;

	var server = net.createServer(function (conn) {
		console.log('client connected');

		var connected = false;

		var write = function (msgData) {
			var msg = new Message(msgData);
			var bufferData = msg.encode().toBuffer();

			var bufferHeader = new Buffer(4);
			bufferHeader.writeUInt32BE(bufferData.length, 0);

			var buf = Buffer.concat([bufferHeader, bufferData]);
			conn.write(buf);
		};
		var close = function () {
			conn.end();
		};

		conn.on('data', function (buf) {
			var len = buf.readUInt32BE(0);

			var msg;
			try {
				msg = Message.decode(buf.slice(buf.length - len));
			} catch (e) {
				console.log('WARN: could not decode data', len, buf);
				return;
			}

			console.log(msg);

			if (!connected && msg.type !== MsgType.CONNECT) {
				write({
					type: 'DISCONNECT',
					response_disconnect: {
						reason_disconnect: proto.ReasonDisconnect.Not_Authenticated
					}
				});
				close();
			}

			switch (msg.type) {
				case MsgType.CONNECT:
					var req = msg.request_connect;
					if (opts.auth_code) { //Check auth code
						if (req.auth_code !== opts.auth_code) {
							write({
								type: 'DISCONNECT',
								response_disconnect: {
									reason_disconnect: proto.ReasonDisconnect.Wrong_Auth_Code
								}
							});
							close();
						}
					}

					// Client successfully connected
					connected = true;

					write({
						type: 'FIRST_DATA_SENT_COMPLETE'
					});
					break;
				case MsgType.DISCONNECT:
					close();
					break;
				default:
					console.warn('WARN: unsupported message type', msg);
			}
		});

		conn.on('end', function () {
			console.log('client disconnected');
		});
		//conn.write('hello\r\n');
	});
	server.listen(opts.port || 5500, function () {
		console.log('Server listening', server.address());
	});
	this.server = server;
}
util.inherits(ClementineServer, events.EventEmitter);

ClementineServer.prototype.broadcast = function (msg) {
	// TODO
};

module.exports = ClementineServer;