var protobuf = require('protobufjs');
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

module.exports = proto;