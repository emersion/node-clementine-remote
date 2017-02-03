var proto = require('./proto');

function MessageBuilder(server) {
	if (!(this instanceof MessageBuilder)) return new MessageBuilder(server);
	this.server = server;
}
MessageBuilder.prototype.change_song = function (playlistId, songIndex) {
	return {
		type: 'CHANGE_SONG',
		request_change_song: {
			playlist_id: playlistId,
			song_index: songIndex
		}
	};
};
MessageBuilder.prototype.set_volume = function (vol) {
	// console.log(this.server.volume);
	return {
		type: 'SET_VOLUME',
		request_set_volume: {
			volume: vol
		}
	};
};
MessageBuilder.prototype.set_track_position = function (pos) {
	return {
		type: 'SET_TRACK_POSITION',
		request_set_track_position: {
			position: pos
		}
	};
};
MessageBuilder.prototype.insert_urls = function (playlistId, urls, opts) {
	opts = opts || {};
	return {
		type: 'INSERT_URLS',
		request_insert_urls: {
			playlist_id: playlistId,
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
	if (!this.server.song) {
		return;
	}

	return {
		type: 'CURRENT_METAINFO',
		response_current_metadata: {
			song_metadata: this.server.song
		}
	};
};
MessageBuilder.prototype._playlist = function (playlist) {
	return {
		id: playlist.id,
		name: playlist.name,
		item_count: playlist.songs.length,
		active: (this.server.activePlaylist === playlist.id),
		closed: false
	};
};
MessageBuilder.prototype.playlists = function () {
	var that = this;

	var playlists = this.server.playlists.map(function (playlist) {
		return that._playlist(playlist);
	});

	return {
		type: 'PLAYLISTS',
		response_playlists: {
			playlist: playlists
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
MessageBuilder.prototype.disconnect = function (reason) {
	return {
		type: 'DISCONNECT',
		response_disconnect: {
			reason_disconnect: proto.ReasonDisconnect[reason]
		}
	};
};

module.exports = MessageBuilder;