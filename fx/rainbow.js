var util = require('./fx_util')

module.exports = function(layout, name) { return {

    // FX configuration
	layout: layout,
	_fps: 30,
	anim: {},
	/** color offset, 0..255 */
	_offset: 46,
	/** amount of 1/10th seconds for one full colorwheel cycle */
    _speed: 6000,
	/** length (in LEDs) for a full colorwheel. 0=synchronous, all LEDs have the same color */
	_cyclelen: 600,
	_startTime: new Date(),
	
    getName: function() {
        return "rainbow"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Speed', type: 'int', id: 'speed', desc: 'amount of 1/10th seconds for a full cycle', css:'width:50px;' },
			{ name: 'Cycle Length', type: 'int', id: 'cyclelen', desc: 'number of LEDs for a full color cycle', css:'width:50px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { speed: this._speed, cyclelen: this._cyclelen }
	},
	
	setConfigData: function(data) {
		this._speed = data.speed
		this._cyclelen = data.cyclelen
	},

	saveConfigData: function() {
		return { speed: this._speed, cyclelen: this._cyclelen, anim: { deltaT: new Date() - this._startTime } }
	},
	
	loadConfigData: function(data) {
		this._speed = data.speed
		// old value 'len': deprecated, not used anymore
		if ('anim' in data) {
			this._startTime = new Date() -  data.anim.deltaT
		} else {
    		// previously _offset was used with a different calculation -> too lazy to write converter, just ignore
			this._startTime = new Date()
		}
		this._cyclelen = data.cyclelen
	},

	_colorwheel: function(pos) {
		pos = 255 - Math.floor(pos);
		if (pos < 85) { return { r: 255 - pos * 3, g: 0, b: pos * 3 } }
		else if (pos < 170) { pos -= 85; return { r:0, g: pos * 3, b: 255 - pos * 3 } }
		else { pos -= 170; return { r: pos * 3, g: 255 - pos * 3, b: 0 } }
	},
	
	// Todo dead code, move to separate effect?
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

    renderColors: function(canvas, variables) {
		this.animate()
		for (let i = 0; i < this.layout.fxLength; i++) {
			let colIdx = this._offset + (this._cyclelen ? 256 * (i + this.layout.fxStart) / this._cyclelen : 0)
			colIdx = Math.floor(colIdx) % 256
			if (colIdx < 0) colIdx += 256
			let targetIdx = this.layout.canvasStart + (this.layout.reverse ? this.layout.fxLength - i - 1 : i)
			canvas[targetIdx] = this._colorwheel(colIdx)
		}
    	return canvas
    },
    
}}
