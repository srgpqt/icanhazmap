var extend = require('./extend');
var MercatorProjection = require('./mercator');
var AnimationFrame = require('./animation_frame');

var PI2 = Math.PI * 2,
	doubleTapDelay = 500,
	doubleTapTolerance2 = 10 * 10,
	animationDuration = 750,
	rotationSnapStep = Math.PI * 0.25,
	rotationSnapTolerance = Math.PI / 180 * 12,
	rotationLockDeadZone = 40,
	rotationLockTolerance = Math.PI / 180 * 8;

var kAddEventListener = 'addEventListener',
	kRemoveEventListener = 'removeEventListener',
	kWheel = 'wheel',
	kDblClick = 'dblclick',
	kDragStart = 'dragstart',
	kMouseDown = 'mousedown',
	kMouseMove = 'mousemove',
	kMouseUp = 'mouseup',
	kTouchStart = 'touchstart',
	kTouchMove = 'touchmove',
	kTouchEnd = 'touchend';

module.exports = MicroMap;

function MicroMap(options) {
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

	this.render = options.render || noop;

	this.minZoom   = options.minZoom || 0;
	this.maxZoom   = options.maxZoom || 18;
	this.zoomLevel = options.zoomLevel || 0;
	this.nominalTileSize = options.nominalTileSize || 256;
	this.maxPixelRatio = options.maxPixelRatio || 1;
	
	this.projection       = options.projection || MercatorProjection;
	this.rotation         = options.rotation || 0;
	this.normalizedCenter = options.center ? this.projection.normalize(options.center) : [0, 0];

	this._animationStartTime = 0;

	this._resize = this.resize.bind(this, null, null);
	this._didRefresh = this.didRefresh.bind(this);
	this._renderAnimation = this.renderAnimation.bind(this);

	if (options.interactive !== false) {
		this.bindEvents();
	}

	window.addEventListener('resize', this._resize);
	AnimationFrame.request(this._resize);
}

extend(MicroMap, {
	pickDomain: function pickDomain(x, y, z, domains) {
		return domains[(z * 211 + y * 61 + x) % domains.length];
	}
});

extend(MicroMap.prototype, {
	destroy: function destroy() {
		this.unbindEvents();
		window.removeEventListener('resize', this._resize);
		this.canvas = this.context = null;
		this.render = noop;
	},

	resize: function resize(width, height) {
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

		this.render();
	},

	refresh: function refresh() {
		if (!this.refreshing) {
			this.refreshing = true;
			AnimationFrame.request(this._didRefresh);
		}
	},

	didRefresh: function didRefresh() {
		this.refreshing = false;
		this.render();
	},

	renderTiles: function renderTiles(tiles) {
		tiles.render(
			this.context,
			this.canvas.width, this.canvas.height,
			this.normalizedCenter, this.zoomLevel, this.rotation,
			this.pixelRatio, this.nominalTileSize
		);
	},

	resetTransform: function resetTransform() {
		this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
	},

	getCenterLatLng: function getCenterLatLng() {
		return this.projection.denormalize(this.normalizedCenter);
	},

	lngLatToClient: function lngLatToClient(coords) {
		return this.normalizedToClient(this.projection.normalize(coords));
	},

	clientToLngLat: function clientToLngLat(clientCoords) {
		return this.projection.denormalize(this.clientToNormalized(clientCoords));
	},

	normalizedToClient: function normalizedToClient(v) {
		var scale = Math.pow(2, this.zoomLevel) * this.nominalTileSize,
			rotateCos = Math.cos(this.rotation),
			rotateSin = Math.sin(this.rotation),
			c = this.normalizedCenter,
			x = v[0] - c[0],
			y = v[1] - c[1];

		return [
			(x * rotateCos - y * rotateSin) * scale + this.canvas.clientWidth  * 0.5,
			(x * rotateSin + y * rotateCos) * scale + this.canvas.clientHeight * 0.5
		];
	},

	clientToNormalized: function clientToNormalized(v) {
		var scale = Math.pow(2, this.zoomLevel) * this.nominalTileSize,
			rotateCos = Math.cos(-this.rotation),
			rotateSin = Math.sin(-this.rotation),
			c = this.normalizedCenter,
			x = v[0] - this.canvas.clientWidth  * 0.5,
			y = v[1] - this.canvas.clientHeight * 0.5;

		return [
			(x * rotateCos - y * rotateSin) / scale + c[0],
			(x * rotateSin + y * rotateCos) / scale + c[1]
		];
	},

	clientToPolar: function clientToPolar(v) {
		return cartesianToPolar(
			v[0] - this.canvas.clientWidth  * 0.5,
			v[1] - this.canvas.clientHeight * 0.5
		);
	},

	polarToClient: function polarToClient(v) {
		var c = polarToCartesian(v[0], v[1]);
		return [
			c[0] + this.canvas.clientWidth  * 0.5,
			c[1] + this.canvas.clientHeight * 0.5
		];
	},

	setView: function setView(normalizedCenter, zoomLevel, rotation, animate) {
		normalizedCenter = [
			wrap(normalizedCenter[0], 1.0),
			wrap(normalizedCenter[1], 1.0)
		];

		zoomLevel = clamp(zoomLevel, this.minZoom, this.maxZoom);

		rotation = wrap(rotation, PI2);

		if (this.normalizedCenter !== normalizedCenter || this.zoomLevel !== zoomLevel || this.rotation !== rotation) {
			this.normalizedCenter = normalizedCenter;
			this.zoomLevel = zoomLevel;
			this.rotation = rotation;

			this.render();

			if (animate) {
				this._animationStartTime = +(new Date());
				this._animationStartCenter = this.normalizedCenter;
				this._animationStartZoom = this.zoomLevel;
				this._animationStartRotation = this.rotation;

				if (!this._animationFrame) {
					this._animationFrame = AnimationFrame.request(this._renderAnimation);
				}
			}
		}
	},

	setLngLat: function setLngLat(lngLat, animate) {
		return this.setView(this.projection.normalize(lngLat), this.zoomLevel, this.rotation, animate);
	},

	setZoom: function setZoom(zoomLevel, animate) {
		return this.setView(this.normalizedCenter, zoomLevel, this.rotation, animate);
	},

	zoomAtXY: function zoomAtXY(zoomIncrement, around, animate) {
		var c = this.normalizedCenter,
			v = this.clientToNormalized(around);

		return this.setView(c, this.zoomLevel + zoomIncrement, this.rotation, animate);
	},

	panByXY: function panByXY(byX, byY, animate) {
		var scale = Math.pow(2, this.zoomLevel) * this.nominalTileSize,
			rotateCos = Math.cos(-this.rotation),
			rotateSin = Math.sin(-this.rotation),
			c = this.normalizedCenter,
			x = c[0] - (byX * rotateCos - byY * rotateSin) / scale,
			y = c[1] - (byX * rotateSin + byY * rotateCos) / scale

		return this.setView([x, y], this.zoomLevel, this.rotation, animate);
	},

	setRotation: function setRotation(radians, animate) {
		this.setView(this.normalizedCenter, this.zoomLevel, radians, animate);
	},

	rotate: function rotate(radians, animate) {
		this.setView(this.normalizedCenter, this.zoomLevel, this.rotation + radians, animate);
	},

	snapRotation: function snapRotation() {
		var snapMod = wrap(this.rotation, rotationSnapStep);

		if (snapMod < rotationSnapTolerance) {
			this.rotate(-snapMod);
		}
		else if ((rotationSnapStep - snapMod) < rotationSnapTolerance) {
			this.rotate(rotationSnapStep - snapMod);
		}
	},

	renderAnimation: function renderAnimation() {
		if ((+(new Date()) - this._animationStartTime) < animationDuration) {
			this._animationFrame = AnimationFrame.request(this._renderAnimation);
		} else {
			this._animationFrame = null;
		}
		this.render();
	},

	trapRotation: function trapRotation(startPolar, currentPolar) {
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
	},

	_checkDoubleTap: function _checkDoubleTap(touches) {
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
	},

	manipulate: function manipulate(previousTouch0, currentTouch0, previousTouch1, currentTouch1, startTouch0, startTouch1) {
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

		var lengthDelta = currentPolar[0] - previousPolar[0];

		this.setZoom(lengthDelta / this.nominalTileSize + this.zoomLevel);

		this.panByXY(
			currentCenter[0] - previousCenter[0],
			currentCenter[1] - previousCenter[1]
		);

		if (!this.trapRotation(startPolar, currentPolar)) {
			this.rotate(currentPolar[1] - previousPolar[1]);
		}
	},

	bindEvents: function bindEvents() {
		var element = this.canvas;
		element[kAddEventListener](kWheel, this.onWheel);
		element[kAddEventListener](kDblClick, this.onDblClick);
		element[kAddEventListener](kDragStart, this.onDragStart);
		element[kAddEventListener](kMouseDown, this.onMouseDown);
		element[kAddEventListener](kMouseMove, this.onMouseMove);
		element[kAddEventListener](kMouseUp, this.onMouseUp);
		element[kAddEventListener](kTouchStart, this.onTouchStart);
		element[kAddEventListener](kTouchMove, this.onTouchMove);
		element[kAddEventListener](kTouchEnd, this.onTouchEnd);
	},

	unbindEvents: function unbindEvents() {
		var element = this.canvas;
		element[kRemoveEventListener](kWheel, this.onWheel);
		element[kRemoveEventListener](kDblClick, this.onDblClick);
		element[kRemoveEventListener](kDragStart, this.onDragStart);
		element[kRemoveEventListener](kMouseDown, this.onMouseDown);
		element[kRemoveEventListener](kMouseMove, this.onMouseMove);
		element[kRemoveEventListener](kMouseUp, this.onMouseUp);
		element[kRemoveEventListener](kTouchStart, this.onTouchStart);
		element[kRemoveEventListener](kTouchMove, this.onTouchMove);
		element[kRemoveEventListener](kTouchEnd, this.onTouchEnd);
	},

	onWheel: function onWheel(event) {
		event.preventDefault();
		this.zoomAtXY(
			Math.log2(Math.abs(event.deltaY) + 1) * (event.deltaY < 0 ? -1 : 1) * -0.1,
			[ event.clientX, event.clientY ]
		);
	},

	onDblClick: function onDblClick(event) {
		event.preventDefault();
		this.zoomAtXY(
			(event.altKey || event.shiftKey) ? -1 : 1,
			[ event.clientX, event.clientY ]
		);
	},

	onDragStart: function onDragStart(event) {
		event.preventDefault();
	},

	onMouseDown: function onMouseDown(event) {
		event.preventDefault();
		this._previousMouse = this._startMouse = [event.clientX, event.clientY];
		this._rotationLocked = null;
	},

	onMouseMove: function onMouseMove(event) {
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

				var zoomLevel = this.zoomLevel + Math.log2(currentPolar[0] / previousPolar[0]),
					rotation = this.rotation + currentPolar[1] - previousPolar[1];
					// rotation = this.rotation;

				// if (!this.trapRotation(startPolar, currentPolar)) {
				// 	rotation += currentPolar[1] - previousPolar[1];
				// }

				this.setView(this.normalizedCenter, zoomLevel, rotation);
			}
		}

		this._previousMouse = current;
	},

	onMouseUp: function onMouseUp(event) {
		event.preventDefault();
		this._previousMouse = null;
		this.snapRotation();
	},

	onTouchStart: function onTouchStart(event) {
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
	},

	onDblTap: function onDblTap(event) {
		event.preventDefault();
		this.zoomAtXY(
			1,
			[ event.touches[0].clientX, event.touches[0].clientY ]
		);
	},

	onTouchMove: function onTouchMove(event) {
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
	},

	onTouchEnd: function onTouchEnd(event) {
		event.preventDefault();
		this._previousTouch0 = this._previousTouch1 = null;
		this.snapRotation();
	}
});

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

function createCustomEvent(type, canBubble, cancelable, detail) {
	var event = document.createEvent('CustomEvent');
	event.initCustomEvent(type, canBubble, cancelable, detail);
	return event;
}
