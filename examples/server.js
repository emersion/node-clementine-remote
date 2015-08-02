var ClementineServer = require('..').Server;

var server = ClementineServer({
	port: 5500,
	auth_code: 42
});

server.on('playpause', function () {
	console.log('playpause');
});

server.listen();