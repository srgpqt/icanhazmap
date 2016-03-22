var colors = {
	base: '#f7ecdc',
	land: '#f7ecdc',
	water: '#357abf',
	grass: '#E6F2C1',
	beach: '#FFEEC7',
	park: '#a5af6e',
	cemetery: '#D6DED2',
	wooded: '#C3D9AD',
	agriculture: '#F2E8B6',
	building: '#b3bdc4',
	hospital: 'rgb(229,198,195)',
	school: '#FFF5CC',
	sports: '#B8E6B8',
	residential: '#f7ecdc',
	commercial: '#f7ecdc',
	industrial: '#f7ecdc',
	parking: '#EEE',
	big_road: '#673919',
	little_road: '#b29176',
	railway: '#ef7369'
};

var colorMap = {
	allotments: colors.base,
	apron: colors.base,
	brownfield: colors.park,
	cemetery: colors.cemetery,
	cinema: colors.base,
	college: colors.school,
	commercial: colors.industrial,
	common: colors.residential,
	conservation: colors.park,
	farm: colors.park,
	farmland: colors.park,
	farmyard: colors.park,
	footway: colors.little_road,
	forest: colors.park,
	fuel: colors.base,
	garden: colors.park,
	glacier: colors.water,
	golf_course: colors.sports,
	grass: colors.park,
	highway: colors.big_road,
	hospital: colors.hospital,
	industrial: colors.industrial,
	land: colors.land,
	library: colors.school,
	meadow: colors.park,
	major_road: colors.big_road,
	minor_road: colors.little_road,
	nature_reserve: colors.park,
	park: colors.park,
	park: colors.park,
	parking: colors.parking,
	pedestrian: colors.little_road,
	pitch: colors.base,
	place_of_worship: colors.base,
	playground: colors.sports,
	protected: colors.park,
	protected_area: colors.park,
	quarry: colors.industrial,
	rail: colors.big_road,
	railway: colors.railway,
	recreation_ground: colors.park,
	residential: colors.residential,
	retail: colors.industrial,
	runway: colors.base,
	school: colors.school,
	scrub: colors.park,
	sports_centre: colors.sports,
	stadium: colors.sports,
	taxiway: colors.little_road,
	theatre: colors.industrial,
	university: colors.school,
	urban_area: colors.residential,
	village_green: colors.park,
	wetland: colors.water,
	wood: colors.wooded
};

exports.normalize = normalize;
function normalize(topojson, projection, tileX, tileY, tileZ) {
	var arcs = topojson.arcs,
		transform = topojson.transform,
		scale = transform.scale,
		scaleX = scale[0],
		scaleY = scale[1],
		translate = transform.translate,
		translateX = translate[0],
		translateY = translate[1],
		tileCount  = 1 << tileZ,
		tileSize   = 1 / tileCount,
		tileTranslateX = tileX * tileSize,
		tileTranslateY = tileY * tileSize,
		normalized;

	for (var i = 0; i < arcs.length; ++i) {
		var arc = arcs[i], x = 0, y = 0;

		for (var j = 0; j < arc.length; ++j) {
			var point = arc[j];

			x += point[0];
			y += point[1];

			normalized = projection.normalize(x * scaleX + translateX, y * scaleY + translateY);
			point[0] = (normalized[0] - tileTranslateX) / tileSize;
			point[1] = (normalized[1] - tileTranslateY) / tileSize;
		}
	}

	return topojson;
}

exports.draw = draw;
function draw(context, width, height, topojson) {
	if (!topojson) {
		return;
	}

	var objects = topojson.objects,
		transform = topojson.transform,
		drawFunctions = {
			GeometryCollection: drawGeometryCollection,
			MultiLineString: drawMultiLineString,
			LineString: drawLineString,
			Polygon: drawPolygon,
			MultiPolygon: drawMultiPolygon
		};

	function drawObjects(objects) {
		for (var i = 0; i < objects.length; ++i) {
			var object = objects[i],
				drawFn = drawFunctions[object.type];

			if (!drawFn) {
				console.log('Unknown TopoJSON object type: ' + object.type);
				continue;
			}

			drawFn(object);
		}
	}

	function drawGeometryCollection(object) {
		return drawObjects(object.geometries);
	}

	function drawLineString(object) {
		drawArcs.call(null, object.arcs);
		context.stroke();
	}

	function drawMultiLineString(object) {
		drawArcs.apply(null, object.arcs);
		context.stroke();
	}

	function drawPolygon(object) {
		drawArcs.call(null, object.arcs);
		context.fill();
	}

	function drawMultiPolygon(object) {
		drawArcs.apply(null, object.arcs);
		context.fill();
	}

	function drawArcs() {
		var arg, arcs, i, j, k, last;

		context.beginPath();

		for (arg = 0; arg < arguments.length; ++arg) {
			arcs = arguments[arg];

			for (i = 0; i < arcs.length; ++i) {
				j = arcs[i];

				if (j >= 0) {
					arc = topojson.arcs[ j ];

					context.moveTo(arc[0][0] * width, arc[0][1] * height);

					for (k = 1; k < arc.length; ++k) {
						context.lineTo(arc[k][0] * width, arc[k][1] * height);
					}
				}
				else {
					arc = topojson.arcs[ ~j ];
					last = arc.length - 1;

					context.moveTo(arc[last][0] * width, arc[last][1] * height);

					for (k = last; k > 0; --k) {
						context.lineTo(arc[k][0] * width, arc[k][1] * height);
					}
				}
			}
		}
	}

	// "boundaries", "buildings", "landuse_labels", "places", "transit", "pois", "landuse"

	// context.fillStyle = context.strokeStyle = '#F6F1EC';
	// drawObjects([ objects.earth ]);

	// context.fillStyle = context.strokeStyle = colors.park;
	// drawObjects([ objects.landuse ]);

	context.fillStyle = context.strokeStyle = '#A8C8EA';
	drawObjects([ objects.water ]);

	context.fillStyle = context.strokeStyle = '#B1ADA9';
	drawObjects([ objects.roads ]);
}
