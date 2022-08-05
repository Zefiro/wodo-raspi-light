var util = require('./fx_util')

module.exports = function(layout, name) { self = {

    // FX configuration
	layout: layout,
	anim: {},
	/** color offset, 0..255, gets calculated in animate() */
	_offset: 0,
	/** amount of 1/10th seconds for one full colorwheel cycle */
    _speed: 6000,
	/** length (in LEDs) for a full colorwheel. 0=synchronous, all LEDs have the same color */
	_cyclelen: 600,
	_startTime: new Date() - 111529, // start with a nice green
	
	colorPoints: [
		{ r:   0, g: 255, b:   0, len: 100 },
		{ r:   0, g: 255, b: 255, len: 100 },
		{ r:  20, g:  20, b: 255, len: 100 },
//		{ r: 128, g:   0, b: 255, len: 100 },
		{ r: 255, g: 128, b:   0, len:  20 },
		{ r: 255, g: 128, b:   0, len: 100 },
		{ r: 255, g: 255, b:   0, len:  30 },
		{ r: 255, g: 255, b:   0, len:  80 },
	],
	colorPointFullLength: 0,
	
	init: function() {
		// pre-calculate color data
		this.colorPointFullLength = this.colorPoints.reduce((acc, point) => acc + point.len, 0)
		for(let idx=0; idx < this.colorPoints.length; idx++) {
			let col1 = this.colorPoints[idx]
			let col2 = this.colorPoints[(idx + 1) % this.colorPoints.length]
			col1.diffR = col2.r - col1.r
			col1.diffG = col2.g - col1.g
			col1.diffB = col2.b - col1.b
		}
	},

    getName: function() {
        return "ainbow"
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
		this._startTime = new Date() -  data.anim.deltaT
		this._cyclelen = data.cyclelen
	},
	
	_colorwheel: function(pos) {
		let colorPointIdx = 0
		pos = pos % this.colorPointFullLength
		if (pos < 0) pos += this.colorPointFullLength
		while (pos >= this.colorPoints[colorPointIdx].len) {
			pos -= this.colorPoints[colorPointIdx].len
			colorPointIdx++
			if (colorPointIdx >= this.colorPoints.length) { // if this happens, then the modulo colorPointFullLength failed
				console.log("Overflow:", pos, colorPointIdx, this.colorPoints.length)
				return { r:   0, g:   0, b: 0 }
			}
		}
		let map2 = function(a, b, y, z) {
			return Math.floor(b * z / y + a)
		}
		let col1 = this.colorPoints[colorPointIdx]
		let col = { 
			r: map2(col1.r, col1.diffR, col1.len, pos),
			g: map2(col1.g, col1.diffG, col1.len, pos),
			b: map2(col1.b, col1.diffB, col1.len, pos)
		}
		return col
	},
	
	animate: function() {
		if (this._speed == 0) return
		let deltaT = new Date() - this._startTime
		this._offset = (deltaT / 100 * this.colorPointFullLength / this._speed) % this.colorPointFullLength
	},	

    renderColors: function(canvas, variables) {
		this.animate()
		for (let i = 0; i < this.layout.fxLength; i++) {
			let colIdx = this._offset + (this._cyclelen ? this.colorPointFullLength * (i + this.layout.fxStart) / this._cyclelen : 0)
			colIdx = Math.floor(colIdx) % this.colorPointFullLength
			let targetIdx = this.layout.canvasStart + (this.layout.reverse ? this.layout.fxLength - i - 1 : i)
			canvas[targetIdx] = this._colorwheel(colIdx)
		}
    	return canvas
    },
    
}
	self.init()
	return self
}
