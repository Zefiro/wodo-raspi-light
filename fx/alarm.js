var util = require('./fx_util')

module.exports = function(layout, name) { return {

    // FX configuration
    layout: layout,
	_startTime: new Date(),
	_speed: 2,
	_duration: 1000,
	_color1: { r: 0, g: 0, b: 0 },
	_color2: { r: 255, g: 0, b: 0 },
	
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
		return { speed: this._speed, duration: this._duration, color1: this._color1, color2: this._color2, anim: { deltaT: new Date() - this._startTime } }
	},
	
	loadConfigData: function(data) {
		// old value 'shift': deprecated, not used anymore
		this._speed = data.speed
		this._duration = data.duration
		this._color1 = data.color1
		this._color2 = data.color2
		if ('anim' in data) {
			this._startTime = new Date() -  data.anim.deltaT
		} else {
    		// previously relCycleStart was used with a different calculation -> too lazy to write converter, just ignore
			this._startTime = new Date()
		}
	},
	
    renderColors: function(canvas) {
		let deltaT = (new Date() - this._startTime) % this._duration
		for (var i = 0; i < this.layout.fxLength; i++) {
			var splitT = (deltaT + (i + this.layout.fxStart) * this._speed) % this._duration
			let col = (splitT < this._duration / 2) ? this._color1 : this._color2
			let targetIdx = this.layout.canvasStart + (this.layout.reverse ? this.layout.fxLength - i - 1 : i)
			canvas[targetIdx] = col
		}
    	return canvas
    },
    
}}
