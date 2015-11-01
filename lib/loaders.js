
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

function imageDrawable() {
	return this.src !== '';
}

function imageComplete() {
	return this.complete && this.src !== '';
}

exports.loadImageElement = loadImageElement;
function loadImageElement(url, onComplete) {
	var img = new Image();

	function onImageError(error) {
		this.onload = this.onerror = img = null;
		(onComplete||noop)('loadImageElement: error', this, error);
	}

	function onImageLoaded() {
		this.onload = this.onerror = img = null;
		if (this.complete) {
			(onComplete||noop)(null, this);
		}
		else {
			debugger;
			(onComplete||noop)('loadImageElement: incomplete', this, 'incomplete');
		}
	}

	img.onerror = onImageError;
	img.onload = onImageLoaded;

	img.tileDrawable = imageDrawable;
	img.tileComplete = imageComplete;

	// Image elements can't be aborted.
	img.abort = img.abort || noop;

	img.src = url;

	return img;
}

exports.loadImageXhr = loadImageXhr;
function loadImageXhr(url, onComplete) {
	var img = new Image();
	var xhr = new XMLHttpRequest();
	var blobURL;

	function onImageError(error) {
		this.onload = this.onerror = img = null;
		URL.revokeObjectURL(blobURL);
		(onComplete||noop)('loadImageXhr: image error', this, error);
	}

	function onImageLoaded() {
		this.onload = this.onerror = img = null;
		URL.revokeObjectURL(blobURL);

		if (this.complete) {
			(onComplete||noop)(null, this);
		}
		else {
			(onComplete||noop)('loadImageXhr: incomplete', this, 'incomplete');
		}
	}

	function onXhrReadyStateChange() {
		if (this.readyState !== 4) {
			return;
		}

		this.onreadystatechange = xhr = null;
		img.abort = noop;

		if (this.response == null) {
			(onComplete||noop)('loadImageXhr: xhr error', img, this);
			return;
		}

		var blob = makeBlob(this.response);
		blobURL = URL.createObjectURL(blob);
		img.onerror = onImageError;
		img.onload = onImageLoaded;
		img.src = blobURL;
	}

	xhr.timeout = 15000;
	xhr.responseType = 'arraybuffer';
	xhr.onreadystatechange = onXhrReadyStateChange;

	img.tileDrawable = imageDrawable;
	img.tileComplete = imageComplete;

	// Transplant the XHR's abort function onto the image element.
	img.abort = xhr.abort.bind(xhr);

	xhr.open('GET', url, true);
	xhr.send();

	return img;
}

loadImageXhr.supported = (makeBlob != null && URL != null);

exports.loadImage = loadImageXhr.supported ? loadImageXhr : loadImageElement;
