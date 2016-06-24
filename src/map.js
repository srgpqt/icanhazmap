var WebMercator = require('./web_mercator');

var requestAnimationFrame = (
	window.requestAnimationFrame ||
	function(fn) { return setTimeout(fn, 15); }
);

var PI2 = Math.PI * 2,
	zoomRatios = [1, 16, 800],
	doubleTapDelay = 500,
	doubleTapTolerance2 = 17 * 17,
	animationDuration = 750,
	rotationSnapStep = Math.PI * 0.25,
	rotationSnapTolerance = Math.PI / 180 * 12,
	rotationLockDeadZone = 40,
	rotationLockTolerance = Math.PI / 180 * 8;

var kWheel = 'wheel',
	kDblClick = 'dblclick',
	kDragStart = 'dragstart',
	kMouseDown = 'mousedown',
	kMouseMove = 'mousemove',
	kMouseUp = 'mouseup',
	kTouchStart = 'touchstart',
	kTouchMove = 'touchmove',
	kTouchEnd = 'touchend';

module.exports = Map;
function Map(options) {
	this.onWheel = this.onWheel.bind(this);
	this.onDblClick = this.onDblClick.bind(this);
	this.onDragStart = this.onDragStart.bind(this);
	this.onMouseDown = this.onMouseDown.bind(this);
	this.onMouseMove = this.onMouseMove.bind(this);
	this.onMouseUp = this.onMouseUp.bind(this);
	this.onTouchStart = this.onTouchStart.bind(this);
	this.onTouchMove = this.onTouchMove.bind(this);
	this.onTouchEnd = this.onTouchEnd.bind(this);

	this.canvas  = options.canvas || document.createElement('canvas');
	this.context = options.context || this.canvas.getContext('2d', { alpha: false });

	this.minZoom   = options.minZoom || 0;
	this.maxZoom   = options.maxZoom || 18;
	this.zoom = options.zoom || 0;
	this.nominalTileSize = options.nominalTileSize || 256;
	this.maxPixelRatio = options.maxPixelRatio || 1;

	this.projection = options.projection || WebMercator;
	this.rotation   = options.rotation || 0;
	this.normalizedCenter = options.center ? this.projection.normalize(options.center[0], options.center[1]) : [0, 0];

	this.render = options.render || noop;
	this._resize = this.resize.bind(this, null, null);
	this._didRefresh = this.didRefresh.bind(this);
	this._renderAnimation = this.renderAnimation.bind(this);
	this._refreshing = false;
	this._rotationLocked = false;
	this._animationStartTime = 0;


	if (options.interactive !== false) {
		this.bindEvents();
	}

	window.addEventListener('resize', this._resize);
	requestAnimationFrame(this._resize);
}

Map.pickDomain = function pickDomain(x, y, z, domains) {
	return domains[(z * 211 + y * 61 + x) % domains.length];
};

Map.prototype.destroy = function destroy() {
	this.unbindEvents();
	window.removeEventListener('resize', this._resize);
	this.render = noop;
};

Map.prototype.resize = function resize(width, height) {
	var context = this.context,
		backingStorePixelRatio = (
			context.webkitBackingStorePixelRatio ||
			context.mozBackingStorePixelRatio ||
			context.msBackingStorePixelRatio ||
			context.oBackingStorePixelRatio ||
			context.backingStorePixelRatio || 1
		);

	this.pixelRatio = Math.min(this.maxPixelRatio, (window.devicePixelRatio || 1) / backingStorePixelRatio);

	this.canvas.width  = Math.round((width  || this.canvas.clientWidth ) * this.pixelRatio);
	this.canvas.height = Math.round((height || this.canvas.clientHeight) * this.pixelRatio);

	this.render();
};

Map.prototype.refresh = function refresh() {
	if (!this._refreshing) {
		this._refreshing = true;
		requestAnimationFrame(this._didRefresh);
	}
};

Map.prototype.didRefresh = function didRefresh() {
	this._refreshing = false;
	this.render();
};

Map.prototype.renderTiles = function renderTiles(layer) {
	layer.render(
		this.context,
		this.canvas.width, this.canvas.height,
		this.normalizedCenter, this.zoom, this.rotation,
		this.pixelRatio, this.nominalTileSize
	);
};

Map.prototype.resetTransform = function resetTransform() {
	this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
};

Map.prototype.getCenterLngLat = function getCenterLngLat() {
	var c = this.normalizedCenter;
	return this.projection.denormalize(c[0], c[1]);
};

Map.prototype.lngLatToClient = function lngLatToClient(coords) {
	return this.normalizedToClient(this.projection.normalize(coords[0], coords[1]));
};

Map.prototype.clientToLngLat = function clientToLngLat(clientCoords) {
	var c = this.clientToNormalized(clientCoords);
	return this.projection.denormalize(c[0], c[1]);
};

Map.prototype.normalizedToClient = function normalizedToClient(v) {
	var scale = Math.pow(2, this.zoom) * this.nominalTileSize,
		rotateCos = Math.cos(this.rotation),
		rotateSin = Math.sin(this.rotation),
		c = this.normalizedCenter,
		x = v[0] - c[0],
		y = v[1] - c[1];

	return [
		(x * rotateCos - y * rotateSin) * scale + this.canvas.clientWidth  * 0.5,
		(x * rotateSin + y * rotateCos) * scale + this.canvas.clientHeight * 0.5
	];
};

Map.prototype.clientToNormalized = function clientToNormalized(v) {
	var scale = Math.pow(2, this.zoom) * this.nominalTileSize,
		rotateCos = Math.cos(-this.rotation),
		rotateSin = Math.sin(-this.rotation),
		c = this.normalizedCenter,
		x = v[0] - this.canvas.clientWidth  * 0.5,
		y = v[1] - this.canvas.clientHeight * 0.5;

	return [
		(x * rotateCos - y * rotateSin) / scale + c[0],
		(x * rotateSin + y * rotateCos) / scale + c[1]
	];
};

Map.prototype.clientToPolar = function clientToPolar(v) {
	return cartesianToPolar(
		v[0] - this.canvas.clientWidth  * 0.5,
		v[1] - this.canvas.clientHeight * 0.5
	);
};

Map.prototype.polarToClient = function polarToClient(v) {
	var c = polarToCartesian(v[0], v[1]);
	return [
		c[0] + this.canvas.clientWidth  * 0.5,
		c[1] + this.canvas.clientHeight * 0.5
	];
};

Map.prototype.setView = function setView(normalizedCenter, zoom, rotation, animate) {
	normalizedCenter = [
		wrap(normalizedCenter[0], 1.0),
		wrap(normalizedCenter[1], 1.0)
	];

	zoom = clamp(zoom, this.minZoom, this.maxZoom);

	rotation = wrap(rotation, PI2);

	if (this.normalizedCenter !== normalizedCenter || this.zoom !== zoom || this.rotation !== rotation) {
		this.normalizedCenter = normalizedCenter;
		this.zoom = zoom;
		this.rotation = rotation;

		this.render();

		if (animate) {
			this._animationStartTime = +(new Date());
			this._animationStartCenter = this.normalizedCenter;
			this._animationStartZoom = this.zoom;
			this._animationStartRotation = this.rotation;

			if (!this._animationFrame) {
				this._animationFrame = requestAnimationFrame(this._renderAnimation);
			}
		}
	}
};

Map.prototype.setLngLat = function setLngLat(lng, lat, animate) {
	return this.setView(this.projection.normalize(lng, lat), this.zoom, this.rotation, animate);
};

Map.prototype.setZoom = function setZoom(zoom, animate) {
	return this.setView(this.normalizedCenter, zoom, this.rotation, animate);
};

Map.prototype.zoomAtXY = function zoomAtXY(zoomIncrement, around, animate) {
	var c = this.normalizedCenter,
		v = this.clientToNormalized(around);

	return this.setView(c, this.zoom + zoomIncrement, this.rotation, animate);
};

Map.prototype.panByXY = function panByXY(byX, byY, animate) {
	var scale = Math.pow(2, this.zoom) * this.nominalTileSize,
		rotateCos = Math.cos(-this.rotation),
		rotateSin = Math.sin(-this.rotation),
		c = this.normalizedCenter,
		x = c[0] - (byX * rotateCos - byY * rotateSin) / scale,
		y = c[1] - (byX * rotateSin + byY * rotateCos) / scale

	return this.setView([x, y], this.zoom, this.rotation, animate);
};

Map.prototype.setRotation = function setRotation(radians, animate) {
	this.setView(this.normalizedCenter, this.zoom, radians, animate);
};

Map.prototype.rotate = function rotate(radians, animate) {
	this.setView(this.normalizedCenter, this.zoom, this.rotation + radians, animate);
};

Map.prototype.snapRotation = function snapRotation() {
	var snapMod = wrap(this.rotation, rotationSnapStep);

	if (snapMod < rotationSnapTolerance) {
		this.rotate(-snapMod);
	}
	else if ((rotationSnapStep - snapMod) < rotationSnapTolerance) {
		this.rotate(rotationSnapStep - snapMod);
	}
};

Map.prototype.renderAnimation = function renderAnimation() {
	if ((+(new Date()) - this._animationStartTime) < animationDuration) {
		this._animationFrame = requestAnimationFrame(this._renderAnimation);
	} else {
		this._animationFrame = null;
	}
	this.render();
};

Map.prototype.trapRotation = function trapRotation(startPolar, currentPolar) {
	if (this._rotationLocked != null) {
		return this._rotationLocked;
	}

	var lengthDelta = currentPolar[0] - startPolar[0],
		angleDelta  = wrapDelta(currentPolar[1], startPolar[1], PI2);

	if (Math.abs(angleDelta) > rotationLockTolerance) {
		this._rotationLocked = false;
		return false;
	}
	else if (Math.abs(lengthDelta) > rotationLockDeadZone) {
		this._rotationLocked = true;
		return true;
	}

	return true;
};

Map.prototype._checkDoubleTap = function _checkDoubleTap(touches) {
	if (this._tappedTime == null || touches.length !== 1) {
		return;
	}

	var deltaX = touches[0].clientX - this._tappedTouch[0],
		deltaY = touches[0].clientY - this._tappedTouch[1],
		distanceSq = deltaX * deltaX + deltaY * deltaY;

	if (distanceSq > doubleTapTolerance2) {
		return;
	}

	var now = new Date().getTime();

	return (now - this._tappedTime) < doubleTapDelay;
};

Map.prototype.manipulate = function manipulate(previousTouch0, currentTouch0, previousTouch1, currentTouch1, startTouch0, startTouch1) {
	if (currentTouch1 == null) {
		return this.panByXY(
			currentTouch0[0] - previousTouch0[0],
			currentTouch0[1] - previousTouch0[1]
		);
	}

	var previousCenter = [ (previousTouch0[0] + previousTouch1[0]) * 0.5, (previousTouch0[1] + previousTouch1[1]) * 0.5 ],
		currentCenter  = [ ( currentTouch0[0] +  currentTouch1[0]) * 0.5, ( currentTouch0[1] +  currentTouch1[1]) * 0.5 ];

	var startPolar = cartesianToPolar(
		startTouch0[0] - startTouch1[0],
		startTouch0[1] - startTouch1[1]
	);

	var previousPolar = cartesianToPolar(
		previousTouch0[0] - previousTouch1[0],
		previousTouch0[1] - previousTouch1[1]
	);

	var currentPolar = cartesianToPolar(
		currentTouch0[0] - currentTouch1[0],
		currentTouch0[1] - currentTouch1[1]
	);

	var zoom = this.zoom + log2(currentPolar[0] / previousPolar[0]);

	this.setZoom(zoom);

	this.panByXY(
		currentCenter[0] - previousCenter[0],
		currentCenter[1] - previousCenter[1]
	);

	if (!this.trapRotation(startPolar, currentPolar)) {
		this.rotate(currentPolar[1] - previousPolar[1]);
	}
};

Map.prototype.bindEvents = function bindEvents() {
	var element = this.canvas;
	element.addEventListener(kDragStart, this.onDragStart);
	element.addEventListener(kWheel, this.onWheel);
	element.addEventListener(kDblClick, this.onDblClick);
	element.addEventListener(kMouseDown, this.onMouseDown);
	element.addEventListener(kMouseMove, this.onMouseMove);
	element.addEventListener(kMouseUp, this.onMouseUp);
	element.addEventListener(kTouchStart, this.onTouchStart);
	element.addEventListener(kTouchMove, this.onTouchMove);
	element.addEventListener(kTouchEnd, this.onTouchEnd);
};

Map.prototype.unbindEvents = function unbindEvents() {
	var element = this.canvas;
	element.removeEventListener(kDragStart, this.onDragStart);
	element.removeEventListener(kWheel, this.onWheel);
	element.removeEventListener(kDblClick, this.onDblClick);
	element.removeEventListener(kMouseDown, this.onMouseDown);
	element.removeEventListener(kMouseMove, this.onMouseMove);
	element.removeEventListener(kMouseUp, this.onMouseUp);
	element.removeEventListener(kTouchStart, this.onTouchStart);
	element.removeEventListener(kTouchMove, this.onTouchMove);
	element.removeEventListener(kTouchEnd, this.onTouchEnd);
};

Map.prototype.onDragStart = function onDragStart(event) {
	event.preventDefault();
};

Map.prototype.onWheel = function onWheel(event) {
	event.preventDefault();

	var ratio = zoomRatios[event.deltaMode] || 1;

	this.zoomAtXY(event.deltaY * ratio * -0.005, [ event.clientX, event.clientY ]);
};

Map.prototype.onDblClick = function onDblClick(event) {
	event.preventDefault();
	this.zoomAtXY(
		(event.altKey || event.shiftKey) ? -1 : 1,
		[ event.clientX, event.clientY ]
	);
};

Map.prototype.onMouseDown = function onMouseDown(event) {
	event.preventDefault();
	this._previousMouse = this._startMouse = [event.clientX, event.clientY];
	this._rotationLocked = null;
};

Map.prototype.onMouseMove = function onMouseMove(event) {
	var current = [event.clientX, event.clientY];

	event.preventDefault();

	if (this._previousMouse != null) {
		if (event.buttons === 1 && !event.altKey) {
			this.panByXY(
				current[0] - this._previousMouse[0],
				current[1] - this._previousMouse[1]
			);
		}
		else if ((event.buttons === 1 && event.altKey) || event.buttons === 4) {
			// var startPolar    = this.clientToPolar(this._startMouse),
			var previousPolar = this.clientToPolar(this._previousMouse),
				currentPolar  = this.clientToPolar(current);

			var zoom = this.zoom + log2(currentPolar[0] / previousPolar[0]),
				rotation = this.rotation + currentPolar[1] - previousPolar[1];
				// rotation = this.rotation;

			// if (!this.trapRotation(startPolar, currentPolar)) {
			// 	rotation += currentPolar[1] - previousPolar[1];
			// }

			this.setView(this.normalizedCenter, zoom, rotation);
		}
	}

	this._previousMouse = current;
};

Map.prototype.onMouseUp = function onMouseUp(event) {
	event.preventDefault();
	this._previousMouse = null;
	this.snapRotation();
};

Map.prototype.onTouchStart = function onTouchStart(event) {
	event.preventDefault();

	var touch0 = event.touches[0],
		touch1 = event.touches[1];

	this._previousTouch0 = this._startTouch0 = touch0 && [ touch0.clientX, touch0.clientY ];
	this._previousTouch1 = this._startTouch1 = touch1 && [ touch1.clientX, touch1.clientY ];
	this._rotationLocked = null;

	if (this._checkDoubleTap(event.touches)) {
		this._tappedTime = null;
		this.onDblTap(event);
	}
	else {
		this._tappedTime = new Date().getTime();
		this._tappedTouch = this._startTouch0;
	}
};

Map.prototype.onDblTap = function onDblTap(event) {
	event.preventDefault();
	this.zoomAtXY(
		1,
		[ event.touches[0].clientX, event.touches[0].clientY ]
	);
};

Map.prototype.onTouchMove = function onTouchMove(event) {
	event.preventDefault();

	var touch0 = event.touches[0],
		touch1 = event.touches[1],
		currentTouch0 = touch0 && [ touch0.clientX, touch0.clientY ],
		currentTouch1 = touch1 && [ touch1.clientX, touch1.clientY ];

	if (this._tappedTime != null && !this._checkDoubleTap(event.touches)) {
		this._tappedTime = null;
	}

	if (currentTouch0 && this._previousTouch0) {
		this.manipulate(
			this._previousTouch0, currentTouch0,
			this._previousTouch1, currentTouch1,
			this._startTouch0, this._startTouch1
		);
	}

	this._previousTouch0 = currentTouch0;
	this._previousTouch1 = currentTouch1;
};

Map.prototype.onTouchEnd = function onTouchEnd(event) {
	event.preventDefault();
	this._previousTouch0 = this._previousTouch1 = null;
	this.snapRotation();
};

function noop() {}

function clamp(x, min, max) {
	return (
		(x < min) ?
			min
		: (x > max) ?
			max
		:
			x
	);
}

function log2(x) {
	return Math.log(x) / Math.LN2;
}

function wrap(x, bound) {
	return (((x) % bound) + bound) % bound;
}

function wrapDelta(a, b, bound) {
	var halfBound = 0.5 * bound;
	return wrap(b - a + halfBound, bound) - halfBound;
}

function cartesianToPolar(x, y) {
	return [
		Math.sqrt((x * x) + (y * y)),
		Math.atan2(y, x)
	];
}

function polarToCartesian(length, angle) {
	return [
		Math.cos(angle) * length,
		Math.sin(angle) * length
	];
}
