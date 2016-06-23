var quadrants = [1, 1, -1, -1, 1, -1, -1, 1];

module.exports = TileLayer;
function TileLayer(options) {
	this.cacheKeys = [];
	this.cache = {};

	this.loader = options.loader;
	this.cacheSize = options.cacheSize || 64;
}

TileLayer.prototype.getTile = function getTile(tileX, tileY, tileZ, pixelRatio, loadIfMissing) {
	var key = [tileX, tileY, tileZ, pixelRatio || 1].join(':');
	var tile = this.cache[key];

	if (tile == null && loadIfMissing) {
		this.cache[key] = tile = this.loader(tileX, tileY, tileZ, pixelRatio, this.onTileComplete.bind(this, key));
	}

	return tile;
};

TileLayer.prototype.onTileComplete = function onTileComplete(key, error) {
};

TileLayer.prototype.render = function render(context, width, height, normalizedCenter, zoom, rotation, pixelRatio, nominalTileSize) {
	var halfWidth    = width  >> 1,
		halfHeight   = height >> 1,
		zoomRound    = Math.round(zoom),
		zoomScale    = Math.pow(2, zoom - zoomRound),
		tileSize     = Math.round(nominalTileSize * zoomScale) * pixelRatio,
		halfTileSize = tileSize >> 1,
		tileCount    = 1 << zoomRound;

	// cover up antialiasing artifacts (seams between tiles) when rotated
	var tileOverlap = (rotation % (Math.PI * 0.5)) && 0.5;

	var clipTop    = -Math.ceil(Math.sqrt(halfTileSize * halfTileSize * 2)),
		clipLeft   = clipTop,
		clipRight  = width - clipLeft,
		clipBottom = height - clipTop;

	var centerX = normalizedCenter[0] * tileCount,
		centerY = normalizedCenter[1] * tileCount,
		centerTileX = Math.floor(centerX),
		centerTileY = Math.floor(centerY);

	var translateX = Math.round((centerTileX - centerX) * tileSize),
		translateY = Math.round((centerTileY - centerY) * tileSize),
		rotateCos  = Math.cos(rotation),
		rotateSin  = Math.sin(rotation);

	context.translate(halfWidth, halfHeight);
	rotation && context.rotate(rotation);
	context.translate(translateX, translateY);

	var deltaX, deltaY, tileX, tileY;

	function renderCachedLower() {
		for (var zoomDiff = 1; zoomDiff <= 3; ++zoomDiff) {
			if (zoomRound - zoomDiff < 0) {
				continue;
			}

			var tile = this.getTile(
				tileX >> zoomDiff,
				tileY >> zoomDiff,
				zoomRound - zoomDiff,
				pixelRatio, false
			);

			if (tile && tile.isComplete()) {
				tile.drawSubTile(
					context,
					zoomDiff,
					(tileX & ((1 << zoomDiff) - 1)),
					(tileY & ((1 << zoomDiff) - 1)),
					deltaX * tileSize,
					deltaY * tileSize,
					tileSize + tileOverlap,
					tileSize + tileOverlap
				);
				return tile;
			}
		}
	}

	function renderCachedHigher() {
		for (var zoomDiff = 1; zoomDiff <= 1; ++zoomDiff) {
			for (var zoomDiffX = 0; zoomDiffX < (1 << zoomDiff); ++zoomDiffX) {
				for (var zoomDiffY = 0; zoomDiffY < (1 << zoomDiff); ++zoomDiffY) {
					var tile = this.getTile(
						(tileX << zoomDiff) + zoomDiffX,
						(tileY << zoomDiff) + zoomDiffY,
						zoomRound + zoomDiff,
						pixelRatio, false
					);

					if (tile && tile.isComplete()) {
						tile.drawTile(
							context,
							deltaX * tileSize + zoomDiffX * (tileSize >> zoomDiff),
							deltaY * tileSize + zoomDiffY * (tileSize >> zoomDiff),
							(tileSize >> zoomDiff) + tileOverlap,
							(tileSize >> zoomDiff) + tileOverlap
						);
					}
				}
			}
		}
	}

	// draw starting with the tile at the center of the canvas and expanding
	// outward by increasing manhattan distance, mirroring each quadrant
	for (var manhattan = 0, drawing = true; drawing; ++manhattan) {
		drawing = false;

		// keep track of which quadrants run out of the viewport so we can skip
		// tiles further down the same quadrant at the current manhattan distance
		var drawingQuadrants = [];

		for (var manhattanX = manhattan, manhattanY = 0; manhattanY <= manhattan; --manhattanX, ++manhattanY) {
			for (var q = 0; q < quadrants.length; q += 2) {
				if (drawingQuadrants[q] === false) {
					continue;
				}

				// prevent overdraw from mirrored quadrants
				if (q > 2 && (manhattanX === 0 || manhattanY === 0)) {
					continue;
				}
				if (q > 0 && (manhattanX === 0 && manhattanY === 0)) {
					continue;
				}

				deltaX = manhattanX * quadrants[q];
				deltaY = manhattanY * quadrants[q + 1];

				var tileCenterX = deltaX * tileSize + halfTileSize + translateX,
					tileCenterY = deltaY * tileSize + halfTileSize + translateY,
					tileClientX = (tileCenterX * rotateCos - tileCenterY * rotateSin) + halfWidth,
					tileClientY = (tileCenterX * rotateSin + tileCenterY * rotateCos) + halfHeight;

				// viewport clipping test
				if (!(tileClientX >= clipLeft && tileClientX < clipRight && tileClientY >= clipTop && tileClientY < clipBottom)) {
					// skip remaning tiles in this quadrant at this distance
					if (drawingQuadrants[q] === true) {
						drawingQuadrants[q] = false;
					}
					continue;
				}

				drawing = drawingQuadrants[q] = true;

				tileX = (((deltaX + centerTileX) % tileCount) + tileCount) % tileCount;
				tileY = (((deltaY + centerTileY) % tileCount) + tileCount) % tileCount;

				var tile = this.getTile(tileX, tileY, zoomRound, pixelRatio, true);

				if (tile && tile.isComplete()) {
					tile.drawTile(
						context,
						deltaX * tileSize,
						deltaY * tileSize,
						tileSize + tileOverlap,
						tileSize + tileOverlap
					);
				}
				else {
					// tile not ready yet, try to find a suitable replacement from
					// nearby zoom levels
					renderCachedLower.call(this) || renderCachedHigher.call(this);
				}
			}
		}
	}
};
