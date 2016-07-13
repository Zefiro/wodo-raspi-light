var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
    _inputIndexes: [],
    numLeds: _numLeds,
    macros: [{
      speed: 2,
      steps: [
        "............",
    ]},{
      speed: 2,
      steps: [
        "...R.....R..",
        "............",
        "R.....R.....",
        "............",
        "R..R..R..R..",
    ]},{
      speed: 2,
      steps: [
        ".G.....G....",
        "....G.....G.",
        ".G.....G....",
        "....G.....G.",
        ".G.....G....",
    ]},{
      speed: 2,
      steps: [
        "..B.........",
        ".....B......",
        "........B...",
        "...........B",
        "........B..B",
        "..B..B......",
    ]},{
      speed: 2,
      steps: [
        "R.....R.....",
        "...R.....R..",
        ".G..G.......",
        ".......G..G.",
        "R.....R.....",
        "...R.....R..",
        ".G..G.......",
        ".......G..G.",
        "..B..B..B..B",
    ]},{
      speed: 2,
      steps: [
        ".W.W.W.W.W.W",
    ]},{
      speed: 6,
      steps: [
        "Y..........Y",
        ".Y........Y.",
        "..Y......Y..",
        "...Y....Y...",
        "....Y....Y..",
        "Y....Y....Y.",
        ".Y....Y....Y",
        "..Y....Y....",
        "...Y....Y...",
        "..Y......Y..",
        ".Y........Y.",
        "Y..........Y",
    ]}],
    actStep: 0,
    actMacro: 0,
    stepLastTime: new Date().getTime(),
    bpm: 150,
	
    getInputIndexes: function() {
        return this._inputIndexes
    },
    
    getName: function() {
        return "disco"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'BPM', type: 'int', id: 'bpm', desc: 'beats per minute', css:'width:50px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { bpm: this.bpm }
	},
	
	setConfigData: function(data) {
	    this.bpm = data.bpm
	},

	saveConfigData: function() {
		return { bpm: this.bpm }
	},
	
	loadConfigData: function(data) {
	    this.bpm = data.bpm
	},

    renderColors: function(inputColors) {
		colors = []
		// calculate current step
		stepSpeed = 60 * 1000 / (this.bpm) / this.macros[this.actMacro].speed
		now = new Date().getTime()
		if (this.stepLastTime + stepSpeed <= now) {
		    this.stepLastTime = now
		    this.actStep++
		    if (this.actStep >= this.macros[this.actMacro].steps.length) {
		        this.actStep = 0
		        this.actMacro = util.getRandomInt(0, this.macros.length-1)
		        console.log("Macro #" + this.actMacro + " (" + this.macros[this.actMacro].steps.length + " steps)")
		    }
		}
		// display step
		current = this.macros[this.actMacro].steps[this.actStep]
		black = { r: 0, g: 0, b: 0 }
//		console.log(current)
		for(i = 0; i < current.length; i++) {
		    j = current.length - i -1 // switch direction, so that config string and actual 'Regalbrett' match
		    switch(current[i]) {
		        case 'R': col = { r: 255, g: 0, b: 0 }; break
		        case 'G': col = { r: 0, g: 255, b: 0 }; break
		        case 'B': col = { r: 0, g: 0, b: 255 }; break
		        case 'Y': col = { r: 255, g: 200, b: 0 }; break
		        case 'W': col = { r: 255, g: 255, b: 255 }; break
		        default: col = black; break
            }
            colors[i*5+0] = col
            colors[i*5+1] = col
            colors[i*5+2] = black
            colors[i*5+3] = black
            colors[i*5+4] = black
		}
//		console.log(this.actStep + " / " + this.steps.length + " / " + (now+1))
    	return colors
    },
    
}}
