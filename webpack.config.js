var webpack = require('webpack');

module.exports = {
	entry: './index.js',
	devtool: 'source-map',
	output: {
		path: __dirname,
		filename: 'micromap.js',
		library: 'MicroMap',
		libraryTarget: 'umd'
	},
	plugins: [
		new webpack.optimize.UglifyJsPlugin()
	]
};
