var win = window;

exports.request = (
	win.requestAnimationFrame       ||
	win.webkitRequestAnimationFrame ||
	win.mozRequestAnimationFrame    ||
	win.msRequestAnimationFrame     ||
	win.oRequestAnimationFrame      ||
	function (callback) {
		setTimeout(callback, 16);
	}
).bind(null);
