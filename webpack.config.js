var path = require('path');

module.exports = {
	devtool: 'source-map',
	entry: {
		'MicroMap': './src/index.js',
		'MicroMapTopoJSON': './src/topojson',
	},
	output: {
		path: path.join(__dirname, 'dist'),
		filename: '[name].js',
		library: '[name]',
		libraryTarget: 'umd'
	}
};
