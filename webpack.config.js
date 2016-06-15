var path = require('path');

module.exports = {
	devtool: 'source-map',
	entry: './src/index.js',
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'micromap.js',
		library: 'MicroMap',
		libraryTarget: 'umd'
	}
};
