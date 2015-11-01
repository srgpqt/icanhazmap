var Matrix = require('./matrix');

var quadrants = [1, 1, -1, -1, 1, -1, -1, 1];

module.exports = TileLayer;
function TileLayer(options) {
	this.loader = options.loader;
	this.cacheSize = options.cacheSize || 64;
	this.cacheKeys = [];
	this.cache = {};
}

TileLayer.prototype.render = function render(canvas, context, projectedCenter, zoomLevel, matrix, pixelRatio) {
	var loader = this.loader;
	var tile, key;

	context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	context.transform.apply(context, matrix);

	var centerZ = Math.ceil(zoomLevel);
	var centerTileCount = 1 << centerZ;
	var centerX = (projectedCenter[0] * centerTileCount) | 0;
	var centerY = (projectedCenter[1] * centerTileCount) | 0;

	// draw starting with the tile at the center of the screen and expanding
	// outward by increasing manhattan distance, mirroring each quadrant
	for (var manhattan = 0, drawing = true; drawing; ++manhattan) {
		drawing = false;

		// keep track of which quadrants run out of the viewport so we can skip
		// tiles further down the same quadrant at the current manhattan distance
		var drawingQuadrants = [];

		for (var deltaX = manhattan, deltaY = 0; deltaY <= manhattan; --deltaX, ++deltaY) {
			for (var q = 0; q < quadrants.length; q += 2) {
				if (drawingQuadrants[q] === false) {
					continue;
				}

				// prevent overdraw from mirrored quadrants
				if (q > 2 && (deltaX === 0 || deltaY === 0)) {
					continue;
				}
				if (q > 0 && deltaX === 0 && deltaY === 0) {
					continue;
				}

				var tileZ = centerZ;
				var tileCount = 1 << tileZ;
				var normalizedSize = 1.0 / tileCount;
				normalizedSize += normalizedSize / 512; // hide seams

				var x = deltaX * quadrants[q  ] + centerX;
				var y = deltaY * quadrants[q+1] + centerY;
				var normalizedX = x / tileCount;
				var normalizedY = y / tileCount;

				var screenP1 = Matrix.multiplyPoint(matrix, normalizedX, normalizedY);
				var screenP2 = Matrix.multiplyPoint(matrix, normalizedX, normalizedY + normalizedSize);
				var screenP3 = Matrix.multiplyPoint(matrix, normalizedX + normalizedSize, normalizedY);
				var screenP4 = Matrix.multiplyPoint(matrix, normalizedX + normalizedSize, normalizedY + normalizedSize);

				var screenMinX = Math.min(screenP1[0], screenP2[0], screenP3[0], screenP4[0]);
				var screenMaxX = Math.max(screenP1[0], screenP2[0], screenP3[0], screenP4[0]);
				var screenMinY = Math.min(screenP1[1], screenP2[1], screenP3[1], screenP4[1]);
				var screenMaxY = Math.max(screenP1[1], screenP2[1], screenP3[1], screenP4[1]);

				if (!(screenMaxX > 0 && screenMaxY > 0 && screenMinX < canvas.clientWidth && screenMinY < canvas.clientHeight)) {
					// skip remaning tiles in this quadrant at this distance
					if (drawingQuadrants[q] === true) {
						drawingQuadrants[q] = false;
					}

					// prevent drawing tiles outside canvas bounds
					continue;
				}

				drawing = drawingQuadrants[q] = true;

				var tileX = ((x % centerTileCount) + centerTileCount) % centerTileCount;
				var tileY = ((y % centerTileCount) + centerTileCount) % centerTileCount;

				key = [tileX, tileY, tileZ, pixelRatio || 1].join(':');
				tile = this.cache[key];

				if (tile == null) {
					this.cache[key] = tile = loader(tileX, tileY, tileZ, pixelRatio, this.onTileComplete.bind(this, key));
				}

				if (tile.tileComplete()) {
					context.drawImage(tile, normalizedX, normalizedY, normalizedSize, normalizedSize);
					continue;
				}

				for (; tileZ >= centerZ - 1; --tileZ) {
					key = [tileX, tileY, tileZ, pixelRatio || 1].join(':');

					tile = this.cache[key];
					if (tile && tile.tileComplete()) {
						tileCount = 1 << tileZ;
						normalizedSize = 1.0 / tileCount;
						normalizedSize += normalizedSize / 512; // hide seams
						normalizedX = x / tileCount;
						normalizedY = y / tileCount;
						context.drawImage(tile, normalizedX, normalizedY, normalizedSize, normalizedSize);
						break;
					}

					if (tileZ <= 0) {
						break;
					}

					x >>= 1;
					y >>= 1;
					tileX >>= 1;
					tileY >>= 1;
				}
			}
		}
	}
};

TileLayer.prototype.onTileComplete = function onTileComplete(key, error) {
};
