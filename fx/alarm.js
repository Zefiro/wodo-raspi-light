var util = require('./fx_util')

module.exports = function(numLeds, name) { return {

    // FX configuration
	_fps: 30,
    _numLeds: numLeds,
	_cycleStart: 0,
	_shift: 0,
	_speed: 2,
	_duration: 1000,
	_color1: { r: 0, g: 0, b: 0 },
	_color2: { r: 255, g: 0, b: 0 },
	
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "alarm"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Speed', type: 'int', id: 'speed', desc: 'amount of ms delay between LEDs', css:'width:50px;' },
			{ name: 'Duration', type: 'int', id: 'duration', desc: 'duration of the blinking in ms', css:'width:50px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { speed: this._speed, duration: this._duration }
	},
	
	setConfigData: function(data) {
		this._speed = data.speed
		this._duration = data.duration
	},

	saveConfigData: function() {
		return { numLeds: this._numLeds, speed: this._speed, duration: this._duration, shift: this._shift, color1: this._color1, color2: this._color2, relCycleStart: this._cycleStart - Date.now() }
	},
	
	loadConfigData: function(data) {
		this._speed = data.speed
		this._duration = data.duration
		this._shift = data.shift
		this._color1 = data.color1
		this._color2 = data.color2
		this._cycleStart = data.relCycleStart + Date.now()
	},

    renderColors: function(inputColors) {
		colors = []
		var msec = Date.now() - this._cycleStart
		if (msec >= this._duration) {
			this._cycleStart = Date.now()
			msec = 0
		}
		for (var i = 0; i < this._numLeds; i++) {
			col = this._color1
			var msec2 = (msec + i * this._speed + this._shift) % this._duration
			if (msec2 >= (this._duration / 2)) {
				col = this._color2
			}
			colors[i] = col
		}
		this.shift++
    	return colors
    },
    
}}
