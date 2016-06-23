var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
	_fps: 30,
    numLeds: _numLeds,

    _fadeOnTime:  5000,
	_lastTime: 0,
	_mode: 0,
	_travelSpeed: 5000,
	_pulsationSpeed: 3000,

	
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "shadowolf"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Fade On Time', type: 'int', id: 'fadeOnTime', desc: 'time in ms for fade in', css:'width:50px;' },
			{ name: 'Travel Speed', type: 'int', id: 'travelSpeed', desc: 'time for speed in ms', css:'width:50px;' },
			{ name: 'Pulsation Speed', type: 'int', id: 'pulsationSpeed', desc: 'pulsation speed in ms', css:'width:50px;' },
			{ name: 'Modus', type: 'int', id: 'mode', desc: 'Modus: 0 = black, 1 = fade in', css:'width:50px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { fadeOnTime: this._fadeOnTime, travelSpeed: this._travelSpeed, pulsationSpeed: this._pulsationSpeed, mode: this._mode }
	},
	
	setConfigData: function(data) {
		this._fadeOnTime = data.fadeOnTime
		this._travelSpeed = data.travelSpeed
		this._pulsationSpeed = data.pulsationSpeed
		this._mode = data.mode
		this._lastTime = Date.now();
	},

	saveConfigData: function() {
		return { speed: this._speed, len: this.numLeds, _offset: this._offset, cyclelen: this._cyclelen }
	},
	
	loadConfigData: function(data) {
		this._speed = data.speed
		this.numLeds = data.len
		this._offset = data._offset
		this._cyclelen = data.cyclelen
	},

    renderColors: function(inputColors) {
		var timeMs = Date.now() - this._lastTime;
		colors = []
		for (var i = 0; i < this.numLeds; i++) {
			switch (this._mode) {
				case 0:
				   colors[i] = { r: 0, g: 0, b: 0 };
				   break;
				case 1:
				   var ledPos = Math.abs(i - (this.numLeds / 2))
				   var ledTimeDiff = this._travelSpeed * (ledPos / (this.numLeds / 2))
				   var localTimeMs = timeMs - ledTimeDiff
				   if (timeMs < 0) {
					   colors[i] = { r: 0, g: 0, b: 0 };
				   } else if (localTimeMs < this._fadeOnTime) {
    				    var percent = 100 * localTimeMs / this._fadeOnTime;
						colors[i] = util.mapColor({ r: 0, g: 0, b: 0 }, { r: 200, g: 150, b: 0 }, percent);				   
				    } else {
					   colors[i] = { r: 200, g: 150, b: 0 };
					   if (i == 0) {
						   this._mode = 2
					   }
				    }
				   break;
				case 2:
					var timeLoop = (timeMs % this._pulsationSpeed);
					timeLoop = timeLoop > this._pulsationSpeed / 2 ? this._pulsationSpeed - timeLoop : timeLoop;
					colors[i] = util.mapColor({ r: 200, g: 150, b: 0 }, { r: 170, g: 80, b: 0 }, 100 * timeLoop / (this._pulsationSpeed / 2));
				   break;
				case 3:
					var ledPos = Math.abs(i - (this.numLeds / 2))
				   var ledTimeDiff = this._travelSpeed * (1 - ledPos / (this.numLeds / 2))
				   var localTimeMs = timeMs - ledTimeDiff
				   if (timeMs < 0) {
					   colors[i] = { r: 200, g: 150, b: 0 };
				   } else if (localTimeMs < this._fadeOnTime) {
    				    var percent = 100 * localTimeMs / this._fadeOnTime;
						colors[i] = util.mapColor({ r: 200, g: 150, b: 0 }, { r: 0, g: 0, b: 0 }, percent);				   
				    } else {
					   colors[i] = { r: 0, g: 0, b: 0 }
				    }
				   break;
			}
		}
    	return colors
    },
    
}}
