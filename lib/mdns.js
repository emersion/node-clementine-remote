// Try to load the mdns module
// Do not complain if it isn't installed
var mdns;
try {
	mdns = require('mdns');
} catch (err) {}

/**
 * Start the mdns service.
 * @param  {Number}   port The server port.
 * @param  {Function} done The callback.
 */
module.exports = function (port, done) {
	if (!mdns) {
		return done(new Error('Could not find mdns module'));
	}

	var ad = mdns.createAdvertisement(mdns.tcp('clementine'), port, {
		domain: 'local'
	}, function (err, opts) {
		if (err) return done(err);
		done(null, ad);
	});
	ad.start();
};