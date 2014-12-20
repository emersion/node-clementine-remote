var utils = {
	bytebufferToBuffer: function (bytebuffer) {
		// TODO: this is an ugly workaround for the browser
		var buf;
		if (typeof window !== 'undefined') { // In the browser
			return new Buffer(bytebuffer.toBase64(), 'base64');
		} else {
			return bytebuffer.toBuffer();
		}
	}
};

module.exports = utils;