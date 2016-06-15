var topojson = require('./topojson');

var requestTimeout = 15000;

var URL = window.URL || window.webkitURL;
var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
var makeBlob;

function noop() { }

if (BlobBuilder) {
	makeBlob = function makeBlob(data) {
		var bb = new BlobBuilder();
		bb.append(data);
		return bb.getBlob();
	};
}
else if (typeof Blob !== 'undefined') {
	makeBlob = function makeBlob(data) {
		return new Blob([data]);
	};
}

exports.loadImageElement = loadImageElement;
function loadImageElement(url, onComplete) {
	var img = new Image();

	onComplete = onComplete || noop;

	function onImageError(error) {
		this.onload = this.onerror = img = null;
		onComplete(new Error('loadImageElement: error'), this, error);
	}

	function onImageLoaded() {
		this.onload = this.onerror = img = null;
		if (this.complete) {
			onComplete(null, this);
		}
		else {
			onComplete(new Error('loadImageElement: incomplete'), this, 'incomplete');
		}
	}

	img.onerror = onImageError;
	img.onload = onImageLoaded;
	img.src = url;

	return {
		isDrawable: imageDrawable.bind(img),
		isComplete: imageComplete.bind(img),
		drawTile: drawImageTile.bind(img),
		drawSubTile: drawImageSubTile.bind(img),
		// Image elements can't be aborted.
		abort: noop
	};
}

exports.loadImageXhr = loadImageXhr;
function loadImageXhr(url, onComplete) {
	var img = new Image();
	var xhr = new XMLHttpRequest();
	var blobURL;

	onComplete = onComplete || noop;

	function onImageError(error) {
		this.onload = this.onerror = img = null;
		URL.revokeObjectURL(blobURL);
		onComplete(new Error('loadImageXhr: image error'), this, error);
	}

	function onImageLoaded() {
		this.onload = this.onerror = img = null;
		URL.revokeObjectURL(blobURL);

		if (this.complete) {
			onComplete(null, this);
		}
		else {
			onComplete(new Error('loadImageXhr: incomplete'), this, 'incomplete');
		}
	}

	function onXhrReadyStateChange() {
		if (this.readyState !== 4 || img == null) {
			return;
		}

		this.onreadystatechange = xhr = null;

		if (this.response == null) {
			onComplete(new Error('loadImageXhr: xhr error'), img, this);
			return;
		}

		var blob = makeBlob(this.response);
		blobURL = URL.createObjectURL(blob);
		img.onerror = onImageError;
		img.onload = onImageLoaded;
		img.src = blobURL;
	}

	xhr.timeout = requestTimeout;
	xhr.responseType = 'arraybuffer';
	xhr.onreadystatechange = onXhrReadyStateChange;

	xhr.open('GET', url, true);
	xhr.send();

	return {
		isDrawable: imageDrawable.bind(img),
		isComplete: imageComplete.bind(img),
		drawTile: drawImageTile.bind(img),
		drawSubTile: drawImageSubTile.bind(img),
		abort: xhr.abort.bind(xhr)
	};
};

loadImageXhr.supported = (makeBlob != null && URL != null);

exports.loadImage = loadImageXhr.supported ? loadImageXhr : loadImageElement;

function imageDrawable() {
	return this.src !== '';
}

function imageComplete() {
	return this.complete && this.src !== '' && this.width > 0;
}

function drawImageTile(context, destX, destY, destWidth, destHeight) {
	context.drawImage(this, destX, destY, destWidth, destHeight);
}

function drawImageSubTile(context, subLevel, subX, subY, destX, destY, destWidth, destHeight) {
	var srcWidth  = this.width >> subLevel,
		srcHeight = this.height >> subLevel;

	context.drawImage(
		this,
		subX * srcWidth, subY * srcHeight,
		srcWidth, srcHeight,
		destX, destY,
		destWidth, destHeight
	);
}

exports.loadVectorXhr = loadVectorXhr;
function loadVectorXhr(projection, tileX, tileY, tileZ, url, onComplete) {
	var xhr = new XMLHttpRequest();
	var vectorContext = {
		projection: projection,
		topojson: null
	};

	onComplete = onComplete || noop;

	function onXhrReadyStateChange() {
		if (this.readyState !== 4) {
			return;
		}

		this.onreadystatechange = xhr = null;

		if (this.response == null) {
			onComplete(new Error('loadVectorXhr: xhr error'), null, this);
		}
		else {
			vectorContext.topojson = topojson.normalize(this.response, projection, tileX, tileY, tileZ);
			onComplete(null, vectorContext.topojson, this);
		}
	}

	xhr.timeout = requestTimeout;
	xhr.responseType = 'json';
	xhr.onreadystatechange = onXhrReadyStateChange;

	xhr.open('GET', url, true);
	xhr.setRequestHeader('Accept', 'application/json');
	xhr.send();

	return {
		isDrawable: vectorTileComplete.bind(vectorContext),
		isComplete: vectorTileComplete.bind(vectorContext),
		drawTile: drawVectorTile.bind(vectorContext),
		drawSubTile: drawVectorSubTile.bind(vectorContext),
		abort: xhr.abort.bind(xhr)
	};
};

function vectorTileComplete() {
	return this.topojson != null;
}

var tempVectorTileCanvas = document.createElement('canvas');
var tempVectorTileContext = tempVectorTileCanvas.getContext('2d');
function drawVectorTile(context, destX, destY, destWidth, destHeight) {
	var tempCanvas = tempVectorTileCanvas;

	if (tempCanvas.width !== destWidth) {
		tempCanvas.width = destWidth;
	}

	if (tempCanvas.height !== destHeight) {
		tempCanvas.height = destHeight;
	}

	tempVectorTileContext.setTransform(1, 0, 0, 1, 0, 0);
	tempVectorTileContext.clearRect(0, 0, destWidth, destHeight);
	topojson.draw(tempVectorTileContext, destWidth, destHeight, this.topojson);

	context.drawImage(tempCanvas, destX, destY, destWidth, destHeight);
}

var tempVectorSubTileCanvas = document.createElement('canvas');
var tempVectorSubTileContext = tempVectorSubTileCanvas.getContext('2d');
function drawVectorSubTile(context, subLevel, subX, subY, destX, destY, destWidth, destHeight) {
	var tempCanvas = tempVectorSubTileCanvas;

	if (tempCanvas.width !== destWidth) {
		tempCanvas.width = destWidth;
	}

	if (tempCanvas.height !== destHeight) {
		tempCanvas.height = destHeight;
	}

	tempVectorSubTileContext.setTransform(1, 0, 0, 1, 0, 0);
	tempVectorSubTileContext.clearRect(0, 0, destWidth, destHeight);
	tempVectorSubTileContext.setTransform(1, 0, 0, 1, -subX * destWidth, -subY * destHeight);
	topojson.draw(tempVectorSubTileContext, destWidth << subLevel, destHeight << subLevel, this.topojson);

	context.drawImage(tempCanvas, destX, destY, destWidth, destHeight);
}
