
var Matrix = require('./matrix');
var Interaction = require('./interaction');
var MercatorProjection = require('./mercator');

var requestAnimFrame =
	window.requestAnimationFrame       ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame    ||
	window.oRequestAnimationFrame      ||
	window.msRequestAnimationFrame     ||
	function (callback) {
		setTimeout(callback, 16);
	};

function noop() {}

module.exports = MicroMap;

MicroMap.requestAnimFrame = requestAnimFrame;

function MicroMap(options) {
	this.canvas  = options.canvas || document.createElement('canvas');
	this.context = options.context || this.canvas.getContext('2d', { alpha: false });

	this.interaction = options.interaction || new Interaction(this.canvas, this);

	this.render = options.render || noop;

	this.minZoom   = options.minZoom || 0;
	this.maxZoom   = options.maxZoom || 18;
	this.zoomLevel = options.zoomLevel || 0;
	this.worldSize = options.worldSize || 256;
	this.maxPixelRatio = options.maxPixelRatio || 1;
	
	this.center      = options.center || [0, 0];
	this.rotation    = options.rotation || 0;
	this.projection  = options.projection || MercatorProjection;
	this.updateMatrix();

	this.refreshing = false;

	this.resize = function() { this._resize(); }.bind(this);
	this.refresh = function() { this._refresh(); }.bind(this);
	this.didRefresh = function() { this._didRefresh(); }.bind(this);

	window.addEventListener('resize', this.resize);
	requestAnimFrame(this.resize);

	if (options.interactive !== false) {
		this.interaction.enable();
	}
}

MicroMap.prototype.destroy = function destroy() {
	if (this.interaction != null) {
		this.interaction.disable();
		this.interaction = null;
	}

	window.removeEventListener('resize', this.resize);
	this.refresh = this.resize = this.didRefresh = null;
	this.canvas = this.context = null;
	this.render = noop;
};

MicroMap.prototype._resize = function _resize(width, height) {
	var context = this.context;
	var backingStorePixelRatio =
		context.webkitBackingStorePixelRatio ||
		context.mozBackingStorePixelRatio ||
		context.msBackingStorePixelRatio ||
		context.oBackingStorePixelRatio ||
		context.backingStorePixelRatio || 1;

	this.pixelRatio = Math.min(this.maxPixelRatio, (window.devicePixelRatio || 1) / backingStorePixelRatio);

	this.canvas.width  = Math.round((width  || this.canvas.clientWidth ) * this.pixelRatio);
	this.canvas.height = Math.round((height || this.canvas.clientHeight) * this.pixelRatio);

	this.updateMatrix();

	this.render();
};

MicroMap.prototype._refresh = function _refresh() {
	if (!this.refreshing) {
		this.refreshing = true;
		requestAnimFrame(this.didRefresh);
	}
};

MicroMap.prototype._didRefresh = function _didRefresh() {
	this.refreshing = false;
	this.render();
};

MicroMap.prototype.renderTiles = function renderTiles(tiles) {
	tiles.render(this.canvas, this.context, this.projection.project(this.center), this.zoomLevel, this.matrix, this.pixelRatio);
};

MicroMap.prototype.resetTransform = function resetTransform() {
	this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
};

MicroMap.prototype.updateMatrix = function updateMatrix() {
	var c = this.projection.project(this.center);
	var scale = Math.pow(2, this.zoomLevel) * this.worldSize;

	var mat = Matrix.of(
		1, 0, 0, 1,
		this.canvas.clientWidth  * 0.5,
		this.canvas.clientHeight * 0.5
	);
	mat = Matrix.scale(mat, scale, scale);
	mat = Matrix.rotate(mat, this.rotation)
	mat = Matrix.translate(mat, -c[0], -c[1]);

	this.matrix = mat;
	this.inverseMatrix = Matrix.invert(mat);
};

MicroMap.prototype.project = function project(v) {
	v = this.projection.project(v);
	return Matrix.multiplyPoint(this.matrix, v[0], v[1]);
};

MicroMap.prototype.unproject = function unproject(v) {
	v = Matrix.multiplyPoint(this.inverseMatrix, v[0], v[1]);
	return this.projection.unproject(v);
};

MicroMap.prototype.wrap = function wrap(v) {
	v = this.projection.project(v);
	v[0] = v[0] - Math.floor(v[0]);
	v[1] = v[1] - Math.floor(v[1]);
	return this.projection.unproject(v);
};

MicroMap.prototype.zoom = function zoom(zoomLevel) {
	if (zoomLevel < this.minZoom) {
		zoomLevel = this.minZoom;
	}
	else if (zoomLevel > this.maxZoom) {
		zoomLevel = this.maxZoom;
	}

	if (zoomLevel !== this.zoomLevel) {
		this.zoomLevel = zoomLevel;
		this.updateMatrix();
		this.render();
	}
};

MicroMap.prototype.panToLngLat = function panToLngLat(to) {
	this.center = this.wrap(to);
	this.updateMatrix();
	this.render();
};

MicroMap.prototype.panByLngLat = function panByLngLat(by) {
	this.center = this.wrap(this.center[0] + by[0], this.center[1] + by[1]);
	this.updateMatrix();
	this.render();
};

MicroMap.prototype.zoomAtXY = function zoomAtXY(zoomLevel, around) {
	around = this.unproject(around);
	// var before = Matrix.multiplyPoint(this.matrix, around[0], around[1]);

	this.zoom(this.zoomLevel + zoomLevel);
};

MicroMap.prototype.panToXY = function panToXY(to) {
	this.center = this.wrap(this.unproject(to));
	this.updateMatrix();
	this.render();
};

MicroMap.prototype.panByXY = function panByXY(by) {
	var projectedCenter = this.project(this.center);
	projectedCenter[0] -= by[0];
	projectedCenter[1] -= by[1];
	this.center = this.wrap(this.unproject(projectedCenter));
	this.updateMatrix();
	this.render();
};

MicroMap.prototype.manipulate = function manipulate(t0a, t0b, t1a, t1b) {
	if (t1b == null) {
		this.panByXY([
			t0a[0] - t0b[0],
			t0a[1] - t0b[1]
		]);
	}
	else {
		var center0 = [ (t0b[0] + t1b[0]) * 0.5, (t0b[1] + t1b[1]) * 0.5 ];
		var center1 = [ (t0a[0] + t1a[0]) * 0.5, (t0a[1] + t1a[1]) * 0.5 ];

		var deltaX0 = t0b[0] - t1b[0];
		var deltaY0 = t0b[1] - t1b[1];
		var dist0 = Math.sqrt(deltaX0 * deltaX0 + deltaY0 * deltaY0);

		var deltaX1 = t0a[0] - t1a[0];
		var deltaY1 = t0a[1] - t1a[1];
		var dist1 = Math.sqrt(deltaX1 * deltaX1 + deltaY1 * deltaY1);

		this.panByXY([
			center1[0] - center0[0],
			center1[1] - center0[1]
		]);

		this.zoomAtXY(0.02 * (dist1 - dist0), center1);
	}
};
