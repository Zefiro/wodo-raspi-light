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
    console.log("Recreating " + numLeds + " pixels")
	var pixels = []
	pixels[0] = createPixel(rndTemp())
	for(var i = 0; i < numLeds; i += 7) {
		var j = Math.min(i + 7, numLeds-1)
		pixels[j] = createPixel(rndTemp())
		createPixels(pixels, i, j)
	}
	return pixels
}

function createTemperatureMap() {
    var colors = new Array(256)
    var colormap = [
        {idx:   0, col: {r:   0, g:   0, b:   0}},
        {idx:  25, col: {r:  50, g:   0, b:   0}},
        {idx: 100, col: {r: 255, g:   0, b:   0}},
        {idx: 220, col: {r: 255, g: 128, b:   0}},
        {idx: 245, col: {r: 255, g: 180, b:  32}},
        {idx: 256, col: {r: 255, g: 230, b: 200}},
    ]


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

var temperatureColorMap = createTemperatureMap()

module.exports = function(_numLeds) { return {

    // FX configuration
    numLeds: _numLeds,
    pixels: [ createAllPixels(_numLeds), createAllPixels(_numLeds) ] ,
    foo: 0,
    
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "Fire effect"
    },
    
    /** idx: the index in the effect list. Can be used to identify parameters.
     */
    getConfigHtml: function(idx) {
        return "There is currently no configuration for this effect<br>"
    },
    
	getConfigData: function() {
		return { }
	},
	
	setConfigData: function(data) {
	},
    
	loadConfigData: function(data) {
		this.foo = data.foo
		this.pixels = data.pixels
	},
	
	saveConfigData: function() {
	    var cfg = { 
	        foo: this.foo,
	        pixels: this.pixels,
	    }
		return cfg
	},
    
    
    renderColors: function(inputColors) {
        var colors = []
    	this.foo += 0.1
    	if (this.foo >= 100) {
    		this.foo -= 100
    		for(var i = 0; i < this.numLeds; i++) {
    			this.pixels[1][i].counter = this.pixels[0][i].counter
    		}
    		this.pixels[0] = this.pixels[1]
    		this.pixels[1] = createAllPixels(this.numLeds)
    	}
    	for(var i = 0; i < this.numLeds; i++) {
    		this.pixels[0][i].counter += (Math.random() + 0.5) * util.map(this.pixels[0][i].speed, this.pixels[1][i].speed, this.foo)
    		if (this.pixels[0][i].counter > 200) this.pixels[0][i].counter = 0
    		var varianz = this.pixels[0][i].counter > 100 ? 200 - this.pixels[0][i].counter : this.pixels[0][i].counter 
    		var maxTemp = util.map(this.pixels[0][i].maxTemp, this.pixels[1][i].maxTemp, this.foo)
    		var minTemp = util.map(this.pixels[0][i].minTemp, this.pixels[1][i].minTemp, this.foo)
    		var temp = util.map(maxTemp, minTemp, varianz)
    		temp = Math.max(0, Math.min(Math.floor(temp), 255))
    		colors[i] = temperatureColorMap[temp]
    	}
    	return colors
    },
    
}}
