
var matrixOf;
if (typeof Float32Array !== 'undefined' && typeof Float32Array.of === 'function') {
	matrixOf = Float32Array.of.bind(Float32Array);
}
else {
	matrixOf = function matrixOf(a, b, c, d, e, f) {
		return [+a, +b, +c, +d, +e, +f];
	}
}
exports.of = matrixOf;

exports.invert = invert;
function invert(m) {
	var x = m[0] * m[3] - m[1] * m[2];
	return matrixOf(
		 m[3] / x, -m[1] / x,
		-m[2] / x,  m[0] / x,
		(m[2] * m[5] - m[3] * m[4]) / x,
		(m[1] * m[4] - m[0] * m[5]) / x
	);
};

exports.multiply = multiply;
function multiply(m, a, b, c, d, e, f) {
	return matrixOf(
		(m[0] * a) + (m[2] * b),
		(m[1] * a) + (m[3] * b),
		(m[0] * c) + (m[2] * d),
		(m[1] * c) + (m[3] * d),
		(m[0] * e) + (m[2] * f) + m[4],
		(m[1] * e) + (m[3] * f) + m[5]
	);
};

exports.multiplyPoint = multiplyPoint;
function multiplyPoint(m, x, y) {
	return [
		x * m[0] + y * m[2] + m[4],
		x * m[1] + y * m[3] + m[5]
	];
};

exports.translate = translate;
function translate(m, x, y) {
	return multiply(m, 1, 0, 0, 1, x, y);
};

exports.scale = scale;
function scale(m, scaleX, scaleY) {
	return multiply(m, scaleX, 0, 0, scaleY, 0, 0);
};

exports.scaleAt = scaleAt;
function scaleAt(m, scaleX, scaleY, centerX, centerY) {
	m = multiply(m, 1, 0, 0, 1, centerX, centerY)
	m = multiply(m, scaleX, 0, 0, scaleY, 0, 0)
	m = multiply(m, 1, 0, 0, 1, -centerX, -centerY);
	return m;
};

exports.rotate = rotate;
function rotate(m, radians) {
	var cos = Math.cos(radians);
	var sin = Math.sin(radians);
	return multiply(m, cos, sin, -sin, cos, 0, 0);
};

exports.rotateAt = rotateAt;
function rotateAt(m, radians, centerX, centerY) {
	var cos = Math.cos(radians);
	var sin = Math.sin(radians);
	m = multiply(m, cos, sin, -sin, cos, centerX, centerY)
	m = multiply(m, 1, 0, 0, 1, -centerX, -centerY);
	return m;
};
