var protobuf = require('protobufjs');
var ByteBuffer = require('bytebuffer');
var builder = protobuf.loadProtoFile(__dirname+'/remotecontrolmessages.proto');

var ns = 'pb.remote';
function build(type) {
	return builder.build(ns+'.'+type);
}

var proto = {
	MsgType: build('MsgType'),
	EngineState: build('EngineState'),
	RepeatMode: build('RepeatMode'),
	ShuffleMode: build('ShuffleMode'),
	ReasonDisconnect: build('ReasonDisconnect'),
	DownloadItem: build('DownloadItem'),
	Message: build('Message')
};

var Message = proto.Message;

proto.getMsgTypeName = function (typeIndex) {
	for (var name in proto.MsgType) {
		if (proto.MsgType[name] === typeIndex) {
			return name;
		}
	}
	return '';
}

proto.encode = function (msgData) {
	var msg = new Message(msgData);
	var bufferData = msg.encode().toBuffer();

	var bufferHeader = new Buffer(4);
	bufferHeader.writeUInt32BE(bufferData.length, 0);

	var buf = Buffer.concat([bufferHeader, bufferData]);
	return buf;
};

proto.decode = function (buf) {
	// TODO: veryyyy buggy
	var len = buf.readUInt32BE(0);

	if (len <= 0) {
		console.warn('WARN: detected wrong data length', len, buf.length, buf);
	}
	if (buf.length - len < 0) {
		console.warn('WARN: detected wrong data offset', len, buf.length, buf);
	}

	var msg;
	try {
		msg = Message.decode(buf.slice(buf.length - len));
		if (msg.type === 0) throw new Error('Unknown message type');
	} catch (e) {
		console.log('msg len:', len, 'buf:', buf.length, 'offset:', buf.length - len);
		console.log('WARN: could not decode, trying to guess offset', e);
		for (var i = 0; i < buf.length; i++) {
			try {
				msg = Message.decode(buf.slice(i));
				if (msg.type === 0) throw new Error('Unknown message type');
			} catch (e) {
				continue;
			}
			break;
		}
		console.log('WARN: Found offset', i, msg.type);
	}
	return msg;
};

module.exports = proto;
