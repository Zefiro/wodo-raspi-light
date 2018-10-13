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
		var prefix = "fx" + idx + "_"
        html = "<button onclick='"+prefix+"toggleFreeze(!"+prefix+"toggleFreezeValue);return false' id='"+prefix+"btn_Freezer'>Freeze</button><br>"
        html += "<script>var "+prefix+"toggleFreezeValue=false;function "+prefix+"toggleFreeze(value){"
		html += prefix+"toggleFreezeValue=value;"
		html += "if("+prefix+"toggleFreezeValue){console.log('Freeze on');$('#"+prefix+"btn_Freezer').text('Unfreeze');}"
		html += "else{console.log('Freeze off');$('#"+prefix+"btn_Freezer').text('Freeze');}"
		html += "socket.emit('browser-sendConfigUpdate', [{fx:"+idx+",id:0,cfg:{frozen: "+prefix+"toggleFreezeValue}}]);"
		html += "};"+prefix+"toggleFreeze("+this.frozen+")\n"
		html += "fxConfigUpdaters["+idx+"]=function(cfg){\n\
		console.log('browserD-sendConfigUpdate->freeze got cfg: ');\n\
		console.log(cfg);\n"
		html += prefix+"toggleFreezeValue=cfg.frozen;"
		html += "if("+prefix+"toggleFreezeValue){$('#"+prefix+"btn_Freezer').text('Unfreeze');}"
		html += "else{$('#"+prefix+"btn_Freezer').text('Freeze');}"
		html += "}\n"
		html += "</script>\n"
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
