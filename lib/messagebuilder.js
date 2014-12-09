var proto = require('./proto');

function MessageBuilder(server) {
	if (!(this instanceof MessageBuilder)) return new MessageBuilder(server);
	this.server = server;
}
MessageBuilder.prototype.set_volume = function () {
	return {
		type: 'SET_VOLUME',
		request_set_volume: {
			volume: this.server.volume
		}
	};
};

MessageBuilder.prototype.repeat = function () {
	return {
		type: 'REPEAT',
		repeat: {
			repeat_mode: 0
		}
	};
};
MessageBuilder.prototype.shuffle = function () {
	return {
		type: 'SHUFFLE',
		shuffle: {
			shuffle_mode: 0
		}
	};
};

MessageBuilder.prototype.info = function () {
	return {
		type: 'INFO',
		response_clementine_info: {
			version: this.server.version,
			state: proto.EngineState[this.server.state]
		}
	};
};
MessageBuilder.prototype.current_metainfo = function (metadata) {
	return {
		type: 'CURRENT_METAINFO',
		response_current_metadata: {
			song_metadata: metadata
		}
	};
};
MessageBuilder.prototype.playlists = function (playlists) {
	return {
		type: 'PLAYLISTS',
		response_playlists: {
			playlist: playlists
		}
	};
};
MessageBuilder.prototype.playlist_songs = function (playlist, songs) {
	return {
		type: 'PLAYLIST_SONGS',
		response_playlist_songs: {
			requested_playlist: playlist,
			songs: songs
		}
	};
};
MessageBuilder.prototype.update_track_position = function () {
	return {
		type: 'UPDATE_TRACK_POSITION',
		response_update_track_position: {
			position: this.server.position
		}
	};
};
MessageBuilder.prototype.first_data_sent_complete = function () {
	return {
		type: 'FIRST_DATA_SENT_COMPLETE'
	};
};

module.exports = MessageBuilder;