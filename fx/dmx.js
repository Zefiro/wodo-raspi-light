var util = require('./fx_util')

module.exports = function(layout) { return {

    // FX configuration
    layout: layout,
	color: { r: 0, g: 0, b: 0 },
    
    getName: function() {
        return "Displays a single color based on DMX"
    },
	
    getConfigHtml: function(idx) {
        return "";
    },
	
	getConfigData: function() {
		return { color: this.color }
	},
	
	setConfigData: function(data) {
	},
    
	saveConfigData: function() {
		return {  }
	},
	
	loadConfigData: function(data) {
	},
    
    renderColors: function(inputColors, variables) {
        var colors = []
		mod_dmx = variables.get('fx_DMX')
		if (!mod_dmx) return inputColors
		dmx = mod_dmx.get('dmx')
		
		color = { r: dmx[0], g: dmx[1], b: dmx[2] }
		for(var idx=0; idx < this.numLeds; idx++) {
			colors[idx] = color
		}
		return colors
    },
    
}}
