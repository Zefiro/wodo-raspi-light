var util = require('./fx_util')

function createPixel(temp, name) {
	return {
		maxTemp: temp,
		minTemp: Math.max(5, temp / 10),
		speed: Math.random()*temp/8 + 2,
		counter: Math.random()*200
	}
}

function createPixels(pixels, i, j) {
	if (i+1 >= j) return
	var m = ((j - i) >> 1) + i
	var temp2 = rndTemp()
	var temp = util.map(pixels[i].maxTemp, pixels[j].maxTemp, 50)
	temp = util.map(temp, temp2, 10)
	pixels[m] = createPixel(temp)
	createPixels(pixels, i, m)
	createPixels(pixels, m, j)
}

function rndTemp() {
	return Math.floor(Math.random()*Math.random()*200 + Math.random()*100)
}

function createAllPixels(numLeds) {
//    console.log("Recreating " + numLeds + " pixels")
	var pixels = []
	pixels[0] = createPixel(rndTemp())
	for(var i = 0; i < numLeds; i += 7) {
		var j = Math.min(i + 7, numLeds-1)
		pixels[j] = createPixel(rndTemp())
		createPixels(pixels, i, j)
	}
	return pixels
}

function createTemperatureMap(color) {
    var colors = new Array(256)
	var colormap
	if (color == 'blue') {
		colormap = [
			{idx:   0, col: {r:   0, g:   0, b:   0}},
			{idx:  25, col: {r:   0, g:   0, b:  50}},
			{idx: 100, col: {r:   0, g:   0, b: 200}},
			{idx: 220, col: {r:   0, g: 100, b: 210}},
			{idx: 245, col: {r:  30, g: 160, b: 220}},
			{idx: 256, col: {r: 150, g: 200, b: 255}},
		]
	} else if (color == 'green') {
		colormap = [
			{idx:   0, col: {r:   0, b:   0, g:   0}},
			{idx:  25, col: {r:   0, b:   0, g:  50}},
			{idx: 100, col: {r:   0, b:   0, g: 200}},
			{idx: 220, col: {r:   0, b: 100, g: 210}},
			{idx: 245, col: {r:  30, b: 160, g: 220}},
			{idx: 256, col: {r: 150, b: 200, g: 255}},
		]
	} else {
		colormap = [
			{idx:   0, col: {r:   0, g:   0, b:   0}},
			{idx:  25, col: {r:  50, g:   0, b:   0}},
			{idx: 100, col: {r: 255, g:   0, b:   0}},
			{idx: 220, col: {r: 255, g: 128, b:   0}},
			{idx: 245, col: {r: 255, g: 180, b:  32}},
			{idx: 256, col: {r: 255, g: 230, b: 200}},
		]
	}

    lastIdx = 0
    lastCol = {r: 0, g: 0, b: 0}
    for(var mapidx = 0; mapidx < colormap.length; mapidx++) {
        var len = colormap[mapidx].idx - lastIdx
        var thisCol = colormap[mapidx].col
        for(var colorIdxRel = 0; colorIdxRel < len; colorIdxRel++) {
            colors[lastIdx + colorIdxRel] = util.mapColor(lastCol, thisCol, colorIdxRel * 100 / (len-1))
        }
        lastIdx = colormap[mapidx].idx
        lastCol = thisCol
    }
    return colors
}



module.exports = function(layout, name) { 
	var self = {

    // FX configuration
    layout: layout,
	anim: {
	},
	_startTime: new Date(),
    pixels: [[], []],
	type: 'fire',
	color: 'red',
	temperatureColorMap: [],
    
    getName: function() {
        return "Fire effect"
    },
	
	init: function() {
		temperatureColorMap = createTemperatureMap(this.color)
		// using fxLength instead of fxSize since everything outside won't be used anyway
		self.pixels = [ createAllPixels(self.layout.fxLength), createAllPixels(self.layout.fxLength) ]
	},
    
    /** idx: the index in the effect list. Can be used to identify parameters.
     */
    getConfigHtml: function(idx) {
		var colorValues = {
			red: "Red Fire",
			blue: "Blue Fire",
			green: "Green Fire",
		}
		var typeValues = {
			fire: 'fire',
			linear: "linear",
		}
		var metaconfig = { c: [
			{ name: 'color', type: 'combo', id: 'color', desc: 'Color of the effect', css:'width:150px;', combo: colorValues },
			{ name: 'type', type: 'combo', id: 'type', desc: 'Type of the effect', css:'width:150px;', combo: typeValues },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
	
	getConfigData: function() {
        return {
			color: this.color,
			type: this.type,
        }
	},
	
	setConfigData: function(data) {
		this.color = data.color
		this.type = data.type
        temperatureColorMap = createTemperatureMap(this.color)
	},
    	
	saveConfigData: function() {
	    var cfg = { 
	        anim: {
				deltaT: new Date() - this._startTime
			},
	        pixels: this.pixels,
			color: this.color,
			type: this.type,
	    }
		return cfg
	},

	loadConfigData: function(data) {
		this.pixels = data.pixels
		this.color = data.color
		this.type = data.type
		if ('anim' in data) {
			this._startTime = new Date() -  data.anim.deltaT
		} else {
    		// previously foo was used with a different calculation -> too lazy to write converter, just ignore
			this._startTime = new Date()
		}
        temperatureColorMap = createTemperatureMap(this.color)
	},
    	    
    
    renderColors: function(canvas) {
		let deltaT = new Date() - this._startTime
		let slowDeltaT = deltaT / 200
		let transition = slowDeltaT % 100
		let transitionJump = slowDeltaT - transition
		if (transitionJump != self.anim.lastTransitionJump) {
			self.anim.lastTransitionJump = transitionJump
    		for(var i = 0; i < this.numLeds; i++) {
    			this.pixels[1][i].counter = this.pixels[0][i].counter
    		}
    		this.pixels[0] = this.pixels[1]
    		this.pixels[1] = createAllPixels(self.layout.fxLength)
    	}
    	for(var i = 0; i < self.layout.fxLength; i++) {
			// TODO this still relies on calling-frequency instead of Date()
    		this.pixels[0][i].counter += (Math.random() + 0.5) * util.map(this.pixels[0][i].speed, this.pixels[1][i].speed, transition)
    		if (this.pixels[0][i].counter > 200) this.pixels[0][i].counter = 0
    		var varianz = this.pixels[0][i].counter > 100 ? 200 - this.pixels[0][i].counter : this.pixels[0][i].counter 
    		var maxTemp = util.map(this.pixels[0][i].maxTemp, this.pixels[1][i].maxTemp, transition)
    		var minTemp = util.map(this.pixels[0][i].minTemp, this.pixels[1][i].minTemp, transition)
    		var temp = util.map(maxTemp, minTemp, varianz)
			
			if (this.type == "linear") {
				temp = 255 * (i + self.layout.fxStart) / (self.layout.fxSize-1)
			}
			
    		temp = Math.max(0, Math.min(Math.floor(temp), 255))
			let targetIdx = this.layout.canvasStart + (this.layout.reverse ? self.layout.fxLength - i - 1 : i)
    		canvas[targetIdx] = temperatureColorMap[temp]
    	}
    	return canvas
    },
    
}
    self.init()
    return self
}
