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
		onComplete('loadImageElement: error', this, error);
	}

	function onImageLoaded() {
		this.onload = this.onerror = img = null;
		if (this.complete) {
			onComplete(null, this);
		}
		else {
			onComplete('loadImageElement: incomplete', this, 'incomplete');
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
		abort: img.abort && img.abort.bind(img) || noop
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
		onComplete('loadImageXhr: image error', this, error);
	}

	function onImageLoaded() {
		this.onload = this.onerror = img = null;
		URL.revokeObjectURL(blobURL);

		if (this.complete) {
			onComplete(null, this);
		}
		else {
			onComplete('loadImageXhr: incomplete', this, 'incomplete');
		}
	}

	function onXhrReadyStateChange() {
		if (this.readyState !== 4) {
			return;
		}

		this.onreadystatechange = xhr = null;

		if (this.response == null) {
			onComplete('loadImageXhr: xhr error', img, this);
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
}

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
