var hasOwn = {}.hasOwnProperty;

module.exports = function extend(target) {
	var i, src, prop;

	for (i = 1; i < arguments.length; ++i) {
		src = arguments[i];

		for (prop in src) {
			if (hasOwn.call(src, prop)) {
				target[prop] = src[prop];
			}
		}
	}

	return target;
};
