var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
	_fps: 30,
    numLeds: _numLeds,
	/** color offset, 0..255 */
	_offset: 46,
	/** amount of 1/10th seconds for one full colorwheel cycle */
    _speed: 6000,
	/** length (in LEDs) for a full colorwheel. 0=synchronous, all LEDs have the same color */
	_cyclelen: 600,
	
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "rainbow"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Speed', type: 'int', id: 'speed', desc: 'amount of 1/10th seconds for a full cycle', css:'width:50px;' },
			{ name: 'Cycle Length', type: 'int', id: 'cyclelen', desc: 'number of LEDs for a full color cycle', css:'width:50px;' },
			{ name: 'len', type: 'int', id: 'len', desc: 'length', css:'width:50px;' }
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { speed: this._speed, len: this.numLeds, cyclelen: this._cyclelen }
	},
	
	setConfigData: function(data) {
		this._speed = data.speed
		this.numLeds = data.len
		this._cyclelen = data.cyclelen
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

	_colowheel: function(pos) {
		pos = 255 - Math.floor(pos);
		if (pos < 85) { return { r: 255 - pos * 3, g: 0, b: pos * 3 } }
		else if (pos < 170) { pos -= 85; return { r:0, g: pos * 3, b: 255 - pos * 3 } }
		else { pos -= 170; return { r: pos * 3, g: 255 - pos * 3, b: 0 } }
	},

    renderColors: function(inputColors) {
		colors = []
		for (var i = 0; i < this.numLeds; i++) {
			var colIdx = this._offset + (this._cyclelen ? 256 * i / this._cyclelen : 0)
			colIdx = Math.floor(colIdx) % 256
			colors[i] = this._colowheel(colIdx)
		}
		this._offset = (this._offset + (256 / this._fps * 10 / this._speed)) % 256;
    	return colors
    },
    
}}
