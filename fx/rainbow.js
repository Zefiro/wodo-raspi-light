module.exports = function(_numLeds, name) { return {

    // FX configuration
    numLeds: _numLeds,
	offset: 0,
    
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "rainbow"
    },
    
    getConfigHtml: function(idx) {
        return "There is currently no configuration for this effect<br>"
    },
    
	colowheel: function(pos) {
		pos = 255 - pos;
		if (pos < 85) { return { r: 255 - pos * 3, g: 0, b: pos * 3 } }
		else if (pos < 170) { pos -= 85; return { r:0, g: pos * 3, b: 255 - pos * 3 } }
		else { pos -= 170; return { r: pos * 3, g: 255 - pos * 3, b: 0 } }
	},

    renderColors: function(inputColors) {
		colors = []
		for (var i = 0; i < this.numLeds; i++) {
			colors[i] = this.colowheel((this.offset + i) % 256);
		}

		this.offset = (this.offset + 1) % 256;
    	return colors
    },
    
}}
