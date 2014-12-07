var protobuf = require('protobufjs');
var builder = protobuf.loadProtoFile('remotecontrolmessages.proto');

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

proto.getMsgTypeName = function (typeIndex) {
	for (var name in exports.MsgType) {
		if (exports.MsgType[name] === typeIndex) {
			return name;
		}
	}
	return '';
}

module.exports = proto;
