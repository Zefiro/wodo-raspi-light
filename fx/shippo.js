// 2015-01-01 by Shippo
module.exports = function(_numLeds) { return {

    // FX configuration
    numLeds: _numLeds,
	step: 0,
	frame: 0,
    
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "shippo"
    },
    
    getConfigHtml: function(idx) {
        return "<b>I'm a configuration</b> for " + this.getName() + "<br>"
    },
    
    renderColors: function(inputColors) {
		//this.step = (this.step + 200/30/5) % 200
		
		if (this.frame == 0) {
			var colors = []
			for(var i = 0; i < this.numLeds; i+=3 ) {
				if (this.step == 0) {
					colors[i] = { r: 0, g: 0, b: 0 }
					colors[i+1] = { r: 255, g: 0, b: 0 }
					colors[i+2] = { r: 0, g: 0, b: 255 }
					this.step = 1
				} else {
					colors[i] = { r: 0, g: 0, b: 0 }
					colors[i+1] = { r: 0, g: 0, b: 255 }
					colors[i+2] = { r: 255, g: 0, b: 0 }
					this.step = 0
				}
			}
			this.frame = 0
		}
		this.frame++
    	return colors
    },
    
}}
