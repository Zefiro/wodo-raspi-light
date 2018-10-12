// 2015-01-01 by Shippo
module.exports = function(layout) { return {

    // FX configuration
    layout: layout,
	step: 0,
	frame: 0,
    
    getName: function() {
        return "shippo"
    },
    
    getConfigHtml: function(idx) {
        return "<b>I'm a configuration</b> for " + this.getName() + "<br>"
    },
    
    renderColors: function(canvas) {
		//this.step = (this.step + 200/30/5) % 200
		
		if (this.frame == 0) {
			for(var i = 0; i < this.numLeds; i+=3 ) {
				// TODO doesn't respect 'layout' (canvasStart, reverse)
				if (this.step == 0) {
					canvas[i] = { r: 0, g: 0, b: 0 }
					canvas[i+1] = { r: 255, g: 0, b: 0 }
					canvas[i+2] = { r: 0, g: 0, b: 255 }
					this.step = 1
				} else {
					canvas[i] = { r: 0, g: 0, b: 0 }
					canvas[i+1] = { r: 0, g: 0, b: 255 }
					canvas[i+2] = { r: 255, g: 0, b: 0 }
					this.step = 0
				}
			}
			this.frame = 0
		}
		// TODO relies on calling frequency instead of Date()
		this.frame++
    	return canvas
    },
    
}}
