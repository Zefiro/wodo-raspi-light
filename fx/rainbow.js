var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
    _inputIndexes: [],
	_fps: 30,
	_segment: {
		fullLength: _numLeds, // number of LEDs in total, for animation computation
		start: 0, // start index of this segment. 0 <= start <= fullLength
		start2: 0,
		length: _numLeds, // number of LEDs of this segment. 0 < length <= fullLength - start
		reverse: false
	},
	_anim: {},
    numLeds: _numLeds,
	/** color offset, 0..255 */
	_offset: 46,
	/** amount of 1/10th seconds for one full colorwheel cycle */
    _speed: 6000,
	/** length (in LEDs) for a full colorwheel. 0=synchronous, all LEDs have the same color */
	_cyclelen: 600,
	_startTime: new Date(),
	
    getInputIndexes: function() {
        return this._inputIndexes
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
		return { speed: this._speed, len: this.numLeds, cyclelen: this._cyclelen, _anim: { deltaT: new Date() - this._startTime } }
	},
	
	loadConfigData: function(data) {
		this._speed = data.speed
		this.numLeds = data.len
		if ('_anim' in data) {
    		// was previously _offset, should probably be converted to _startTime, but I'm too lazy
			this._startTime = new Date() -  data._anim.deltaT
		}
		this._cyclelen = data.cyclelen
	},

	_colorwheel: function(pos) {
		pos = 255 - Math.floor(pos);
		if (pos < 85) { return { r: 255 - pos * 3, g: 0, b: pos * 3 } }
		else if (pos < 170) { pos -= 85; return { r:0, g: pos * 3, b: 255 - pos * 3 } }
		else { pos -= 170; return { r: pos * 3, g: 255 - pos * 3, b: 0 } }
	},
	
	posterize: function(col) {
		col.r = col.r & 0xC0
		col.g = col.g & 0xC0
		col.b = col.b & 0xC0
		return col
	},
	
	animate: function() {
		let deltaT = new Date() - this._startTime
		this._offset = (deltaT / 100 * 256 / this._speed) % 256;
	},	

    renderColors: function(inputColors, variables) {
		this.animate()
		let colors = inputColors[0] || []
		for (let i = 0; i < this._segment.length; i++) {
			let colIdx = this._offset + (this._cyclelen ? 256 * (i + this._segment.start) / this._cyclelen : 0)
			colIdx = Math.floor(colIdx) % 256
			let targetIdx = this._segment.start2 + (this._segment.reverse ? this._segment.length - i - 1 : i)
			colors[targetIdx] = this.posterize(this._colorwheel(colIdx))
		}
    	return colors
    },
    
}}
