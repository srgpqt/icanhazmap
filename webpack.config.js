var path = require('path');
var webpack = require('webpack');

module.exports = {
	entry: './index.js',
	devtool: 'source-map',
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'micromap.js',
		library: 'MicroMap',
		libraryTarget: 'umd'
	}
};
