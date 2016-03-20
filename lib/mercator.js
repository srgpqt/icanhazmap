function sinh(x) {
	return (Math.exp(x) - Math.exp(-x)) * 0.5;
}

exports.normalize = function normalize(lng, lat) {
	lat *= Math.PI / 180.0;
	return [
		(lng + 180.0) / 360.0,
		(1 - (Math.log(Math.tan(lat) + 1.0 / Math.cos(lat)) / Math.PI)) * 0.5
	];
};

exports.denormalize = function denormalize(x, y) {
	return [
		x * 360.0 - 180.0,
		Math.atan(sinh(Math.PI * (1.0 - y * 2.0))) * 180.0 / Math.PI
	];
};
