var ClementineClient = require('..').Client;

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

	client.play();
});
client.on('disconnect', function (data) {
	console.log('client disconnecting', data);
});
client.on('end', function () {
	console.log('client disconnected');
});