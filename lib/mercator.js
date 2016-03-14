function sinh(x) {
	return (Math.exp(x) - Math.exp(-x)) * 0.5;
}

exports.normalize = function normalize(v) {
	var lat = v[1] / 180.0 * Math.PI;
	return [
		(v[0] + 180.0) / 360.0,
		(1 - (Math.log(Math.tan(lat) + 1.0 / Math.cos(lat)) / Math.PI)) * 0.5
	];
};

exports.denormalize = function denormalize(v) {
	return [
		v[0] * 360.0 - 180.0,
		Math.atan(sinh(Math.PI * (1.0 - v[1] * 2.0))) * 180.0 / Math.PI
	];
};
