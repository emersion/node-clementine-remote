var stream = require('stream');
var util = require('util');

var proto = require('./proto');
var Message = proto.Message;

// TODO: implement Duplex, see http://codewinds.com/blog/2013-08-31-nodejs-duplex-streams.html#creating_a_custom_duplex_stream
function Connection(socket) {
	if (!(this instanceof Connection)) return new Connection(socket);
	stream.Duplex.call(this);

	var that = this;

	this.socket = socket;

	var buf = new Buffer(0), len = null;

	var readDataLength = function () {
		len = buf.readUInt32BE(0);
		//console.log('DATA LENGTH', len);
		// Receiving more than 128mb is very unlikely
		if (len > 134217728) {
			console.warn('WARN: invalid message length, too big', len, buf.length, buf);
			that.end();
			return;
		}
		buf = buf.slice(4);
	};

	socket.on('data', function (data) {
		//console.log('RECEIVED DATA', data.length, data);
		if (buf.length > 0) {
			buf = Buffer.concat([buf, data]);
		} else {
			buf = data;
		}
		if (len === null) {
			readDataLength();
		}
		var msg;
		while (len && buf.length >= len) {
			//msg = proto.decode(buf.slice(0, len));
			try {
				msg = Message.decode(buf.slice(0, len));
			} catch (e) {
				console.log('WARN: could not decode message', e);
				return;
			}
			buf = buf.slice(len);
			that.emit('message', msg);

			if (buf.length > 0) {
				readDataLength();
			} else {
				len = null;
			}
		}
	});

	socket.on('end', function () {
		that.emit('end');
	});

	socket.on('error', function (err) {
		console.warn('WARN: socket error', err);
		that.emit('error', err);
	});
}
util.inherits(Connection, stream.Duplex);

Connection.prototype.write = function (msgData) {
	var msg = new Message(msgData);

	// TODO: this is an ugly workaround for the browser
	var bufferData;
	if (typeof window !== 'undefined') { // In the browser
		bufferData = new Buffer(msg.encode().toBase64(), 'base64');
	} else {
		bufferData = msg.encode().toBuffer();
	}

	var bufferHeader = new Buffer(4);
	bufferHeader.writeUInt32BE(bufferData.length, 0);

	var buf = Buffer.concat([bufferHeader, bufferData]);

	this.socket.write(buf);
};

Connection.prototype.end = function () {
	this.socket.end();
};

module.exports = Connection;