var util = require('./fx_util')

module.exports = function(layout, configManager) { return {

    // FX configuration
	layout: layout,

    _fadeOnTime:  5000,
	_lastTime: 0,
	_mode: 0,
	_travelSpeed: 5000,
	_pulsationSpeed: 3000,

	
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
		return { speed: this._speed, _offset: this._offset, cyclelen: this._cyclelen }
	},
	
	loadConfigData: function(data) {
		// old value 'len': deprecated, not used anymore
		this._speed = data.speed
		this._offset = data._offset
		this._cyclelen = data.cyclelen
	},

    renderColors: function(canvas, variables) {
		var timeMs = Date.now() - this._lastTime;
//		console.log(this._mode)
		// TODO doesn't respect 'layout' (canvasStart, reverse)
		for (var i = 0; i < this.layout.fxLength; i++) {
			switch (this._mode) {
				case 0:
				   canvas[i] = { r: 0, g: 0, b: 0 };
				   break;
				case 1:
				   var ledPos = Math.abs(i - (this.layout.fxLength / 2))
				   var ledTimeDiff = this._travelSpeed * (ledPos / (this.layout.fxLength / 2))
				   var localTimeMs = timeMs - ledTimeDiff
				   if (timeMs < 0) {
					   canvas[i] = { r: 0, g: 0, b: 0 };
				   } else if (localTimeMs < this._fadeOnTime) {
    				    var percent = 100 * localTimeMs / this._fadeOnTime;
						canvas[i] = util.mapColor({ r: 0, g: 0, b: 0 }, { r: 200, g: 150, b: 0 }, percent);				   
				    } else {
					   canvas[i] = { r: 200, g: 150, b: 0 };
					   if (i == 0) {
						   this._mode = 2
					   }
				    }
				   break;
				case 2:
					var timeLoop = (timeMs % this._pulsationSpeed);
					timeLoop = timeLoop > this._pulsationSpeed / 2 ? this._pulsationSpeed - timeLoop : timeLoop;
					canvas[i] = util.mapColor({ r: 200, g: 150, b: 0 }, { r: 170, g: 80, b: 0 }, 100 * timeLoop / (this._pulsationSpeed / 2));
				   break;
				case 3:
					var ledPos = Math.abs(i - (this.layout.fxLength / 2))
				   var ledTimeDiff = this._travelSpeed * (1 - ledPos / (this.layout.fxLength / 2))
				   var localTimeMs = timeMs - ledTimeDiff
				   if (timeMs < 0) {
					   canvas[i] = { r: 200, g: 150, b: 0 };
				   } else if (localTimeMs < this._fadeOnTime) {
    				    var percent = 100 * localTimeMs / this._fadeOnTime;
						canvas[i] = util.mapColor({ r: 200, g: 150, b: 0 }, { r: 0, g: 0, b: 0 }, percent);				   
				    } else {
					   canvas[i] = { r: 0, g: 0, b: 0 }
				    }
				   break;
			}
		}
    	return canvas
    },
    
}}
