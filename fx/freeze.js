var util = require('./fx_util')

module.exports = function(layout, name) { return {

    // FX configuration
	layout: layout,
	lastColors: [],
	frozen: false,
    
    getName: function() {
        return "Freezes a color"
    },
    
    getConfigHtml: function(idx) {
        html = "<button onclick='fx"+idx+"_toggleFreeze(!fx"+idx+"_toggleFreezeValue);return false' id='fx"+idx+"_btn_Freezer'>Freeze</button><br>"
        html += "<script>var fx"+idx+"_toggleFreezeValue=false;function fx"+idx+"_toggleFreeze(value){"
		html += "fx"+idx+"_toggleFreezeValue=value;"
		html += "if(fx"+idx+"_toggleFreezeValue){console.log('Freeze on');$('#fx"+idx+"_btn_Freezer').text('Unfreeze');}"
		html += "else{console.log('Freeze off');$('#fx"+idx+"_btn_Freezer').text('Freeze');}"
		html += "socket.emit('fxConfigWrite', [{fx:"+idx+",id:0,cfg:{frozen: fx"+idx+"_toggleFreezeValue}}]);"
		html += "};fx"+idx+"_toggleFreeze("+this.frozen+")</script>\n"
        return html
    },
	
	getConfigData: function() {
		return { frozen: this.frozen }
	},
	
	setConfigData: function(data) {
		this.frozen = data.frozen
	},
    
	loadConfigData: function(data) {
		this.frozen = data.frozen
		if (data.lastColors) {
		    this.lastColors = data.lastColors
		}
	},
	
	saveConfigData: function() {
	    var cfg = { frozen: this.frozen }
	    if (this.frozen) {
	        cfg.lastColors = this.lastColors
	    }
		return cfg
	},
    
    renderColors: function(canvas) {
        if (this.frozen) {
			// layout changed since frozen?
			if (this.layout.fxLength != this.lastColors.length) {
				console.log("FX: Freeze: resizing necessary! " + this.lastColors.length + " -> " + this.layout.fxLength)
				this.lastColors = util.mergeColors(this.layout.fxLength, this.lastColors)
			}
			return util.mergeColors(this.layout.canvasSize, canvas, this.lastColors, this.layout.canvasStart)
		} else {
			this.lastColors = canvas.slice(this.layout.canvasStart, this.layout.fxLength)
			return canvas
		}
    },
    
}}
