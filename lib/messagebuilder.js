var proto = require('./proto');

function MessageBuilder(server) {
	if (!(this instanceof MessageBuilder)) return new MessageBuilder(server);
	this.server = server;
}
MessageBuilder.prototype.change_song = function (playlist, song) {
	return {
		type: 'CHANGE_SONG',
		request_change_song: {
			playlist_id: playlist,
			song_index: song
		}
	};
};
MessageBuilder.prototype.set_volume = function () {
	return {
		type: 'SET_VOLUME',
		request_set_volume: {
			volume: this.server.volume
		}
	};
};
MessageBuilder.prototype.insert_urls = function (playlist, urls, opts) {
	opts = opts || {};
	return {
		type: 'INSERT_URLS',
		request_insert_urls: {
			playlist_id: playlist,
			urls: urls,
			position: opts.position || -1,
			play_now: opts.play_now || false,
			enqueue: opts.enqueue || false
		}
	};
};

MessageBuilder.prototype.repeat = function () {
	return {
		type: 'REPEAT',
		repeat: {
			repeat_mode: proto.RepeatMode['Repeat_'+this.server.repeat]
		}
	};
};
MessageBuilder.prototype.shuffle = function () {
	return {
		type: 'SHUFFLE',
		shuffle: {
			shuffle_mode: proto.ShuffleMode['Shuffle_'+this.server.shuffle]
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
MessageBuilder.prototype.current_metainfo = function () {
	return {
		type: 'CURRENT_METAINFO',
		response_current_metadata: {
			song_metadata: this.server.song
		}
	};
};
MessageBuilder.prototype._playlist = function (playlist) {
	return {
		id: 0,
		name: playlist.name,
		item_count: playlist.songs.length,
		active: (this.server.playlist === playlist),
		closed: false
	};
};
MessageBuilder.prototype.playlists = function () {
	return {
		type: 'PLAYLISTS',
		response_playlists: {
			playlist: [this._playlist(this.server.playlist)]
		}
	};
};
MessageBuilder.prototype.playlist_songs = function (playlist) {
	return {
		type: 'PLAYLIST_SONGS',
		response_playlist_songs: {
			requested_playlist: this._playlist(playlist),
			songs: playlist.songs
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
MessageBuilder.prototype.library_chunk = function (chunk) {
	return {
		type: 'LIBRARY_CHUNK',
		response_library_chunk: chunk
	};
};

module.exports = MessageBuilder;