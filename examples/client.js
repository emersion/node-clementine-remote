var ClementineClient = require('..').Client;
var sqlite3 = require('sqlite3');
var tmp = require('tmp');
var fs = require('fs');

var client = ClementineClient({
	host: '127.0.0.1',
	port: 5500,
	auth_code: 42
});
client.on('connect', function () {
	console.log('client connected');
});
client.on('ready', function () {
	console.log('client ready');

	client.on('song', function (song) {
		console.log('Now playing', song.title);
	});

	var chunks = null, chunksSize = 0;
	client.on('library', function (library) {
		var query = 'SELECT ROWID as _id, artist, album, title, cast(filename as TEXT) as filename FROM songs';
		library.db.serialize(function () {
			library.db.each(query, function(err, row) {
				console.log(row);
			});
		});
	});
	client.get_library();

	//client.play();
});
client.on('disconnect', function (data) {
	console.log('client disconnecting', data);
});
client.on('end', function () {
	console.log('client disconnected');
});