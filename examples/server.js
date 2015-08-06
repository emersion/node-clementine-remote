var ClementineServer = require('..').Server;

var server = ClementineServer({
	host: '0.0.0.0',
	port: 5500,
	//auth_code: 42
});

server.on('playpause', function () {
	console.log('playpause');
});

server.listen(function () {
	server.mdns();
});
