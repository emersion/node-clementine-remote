var fs = require('fs');
var protobuf = require('protobufjs');

var protoStr = fs.readFileSync(__dirname + '/remotecontrolmessages.proto', 'utf8');
var builder = protobuf.loadProto(protoStr);

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

function getConstName(value, obj) {
	for (var name in obj) {
		if (obj[name] === value) {
			return name;
		}
	}
	return '';
}

proto.getMsgTypeName = function (typeIndex) {
	return getConstName(typeIndex, proto.MsgType);
};
proto.getEngineStateName = function (stateIndex) {
	return getConstName(stateIndex, proto.EngineState);
};
proto.getReasonDisconnectName = function (reasonIndex) {
	return getConstName(reasonIndex, proto.ReasonDisconnect);
};

module.exports = proto;