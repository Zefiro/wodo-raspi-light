var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
    numLeds: _numLeds,
    s_length: 0,
    s_start: 0,
    s_indexes: [],
	
    getInputIndexes: function() {
        return this.s_indexes
    },
    
    getName: function() {
        return "merge"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return {  }
	},
	
	setConfigData: function(data) {
	},

	saveConfigData: function() {
		return { }
	},
	
	loadConfigData: function(data) {
	},

    renderColors: function(inputColors) {
        tempColors = util.mergeColors(this.s_length, inputColors[1])
		colors = util.mergeColors(this.numLeds, inputColors[0], tempColors, this.s_start)
    	return colors
    },
    
}}
