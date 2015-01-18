var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
    numLeds: _numLeds,
	_offset: 0,
	/** amount of 1/10th seconds for one full colorwheel cycle */
    _speed: 10,
	
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "rainbow"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Speed', type: 'int', id: 'speed', desc: 'amount of 1/10th seconds for a full cycle', css:'width:50px;' },
			{ name: 'len', type: 'int', id: 'len', desc: 'length', css:'width:50px;' }
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { speed: this._speed, len: this.numLeds }
	},
	
	setConfigData: function(data) {
		console.log("rainbow.setConfigData:")
		console.log(data)
		this._speed = data.speed
		this.numLeds = data.len
	},

	_colowheel: function(pos) {
		pos = 255 - Math.floor(pos);
		if (pos < 85) { return { r: 255 - pos * 3, g: 0, b: pos * 3 } }
		else if (pos < 170) { pos -= 85; return { r:0, g: pos * 3, b: 255 - pos * 3 } }
		else { pos -= 170; return { r: pos * 3, g: 255 - pos * 3, b: 0 } }
	},

    renderColors: function(inputColors) {
		colors = []
		for (var i = 0; i < this.numLeds; i++) {
			colors[i] = this._colowheel((this._offset + i) % 256);
		}
		this._offset = (this._offset + (256 / 30 * 10 / this._speed)) % 256;
    	return colors
    },
    
}}
