var util = require('./fx_util')

module.exports = function(layout, name) { return {

    // FX configuration
	layout: layout,
	anim: {
		bars: [],
	},
	_startTime: new Date(),
	
    getName: function() {
        return "bars"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return {  }
	},
	
	setConfigData: function(data) {
	},

	saveConfigData: function() {
		return { anim: { deltaT: new Date() - this._startTime } }
	},
	
	loadConfigData: function(data) {
		this._startTime = new Date() -  data.anim.deltaT
	},

	animate: function() {
	},
	
	barColors: [
		{ r: 200, g:   0, b:   0 },
		{ r:   0, g: 200, b:   0 },
		{ r:   0, g:   0, b: 200 },
		{ r: 200, g: 200, b:   0 },
		{ r: 200, g:   0, b: 200 },
		{ r:   0, g: 200, b: 200 },
		{ r: 200, g: 200, b: 200 },
	],
	
	createBar: function() {
		bar = {}
		bar.pos2 = 0
		bar.width2 = 0
		this.moveBar(bar)
		return bar
	},
	
	moveBar: function(bar) {
		bar.startTime = new Date()
		bar.pos1 = bar.pos2
		bar.width1 = bar.width2
		if (bar.width1 == 0) {
			bar.color = this.barColors[util.getRandomInt(0, this.barColors.length-1)]
			bar.pos1 = util.getRandomInt(0, this.layout.fxLength)
		}
		bar.pos2 = bar.pos1 + util.getRandomInt(0, 30) - 15
		bar.width2 = util.getRandomInt(5, 20)
		if (Math.random() < 0.01) {
			bar.width2 = 0
		}
		bar.ttl = Math.abs(bar.pos1 - bar.pos2) / 8
		console.log(bar)
	},
	
    renderColors: function(canvas, variables) {
		this.animate()
		let now = new Date()
		let deltaT = new Date() - this._startTime
		while(this.anim.bars.length < 10) {
			this.anim.bars.unshift(this.createBar())
		}
		this.anim.bars.forEach(bar => {
			p = (now - bar.startTime) / 10 / bar.ttl // time-to-life in seconds
			if (p >= 100) {
				this.moveBar(bar)
				p = 0
			}
			let pos = util.map(bar.pos1, bar.pos2, p)
			let width = util.map(bar.width1, bar.width2, p)
			let idx1 = Math.max(pos - Math.ceil(width/2), 0)
			let idx2 = Math.min(pos + Math.floor(width/2), this.layout.fxLength)
			for(let i = idx1; i <= idx2; i++) {
				let alpha = 100 * (Math.abs(pos - i) / (width/2))^10
				let targetIdx = this.layout.canvasStart + (this.layout.reverse ? this.layout.fxLength - i - 1 : i)
				canvas[targetIdx] = util.mapColor(bar.color, canvas[targetIdx], alpha)
			}
		})
    	return canvas
    },
    
}}
