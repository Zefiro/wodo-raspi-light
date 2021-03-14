const util = require('./fx_util')
const winston = require('winston')

/*
 * Note: this doesn't work nicely as cluster-client, as the local lastColors[] will be overwritten with the servers colors
 */

module.exports = function(layout, name) { 
var self = {

    // FX configuration
	layout: layout,
	lastColors: [],
	frozen: false,
	logger: winston.loggers.get('fx_freeze'),
    
    getName: function() {
        return "Freezes a color"
    },
    
    getConfigHtml: function(idx) {
		var prefix = "fx" + idx + "_"
		let btnText1 = "Freeze" // false => true
		let btnText2 = "Unfreeze" // true => false
		html = `
<button onclick='${prefix}sendUpdateButton(!${prefix}toggleButtonValue);return false' id='${prefix}btn_Freezer'>Freeze</button><br>
<script>
var ${prefix}toggleButtonValue=false
function ${prefix}sendUpdateButton(value){
${prefix}updateButton(value)
socket.emit('browser-sendConfigUpdate', [{fx:${idx},id:0,cfg:{frozen: ${prefix}toggleButtonValue}}]);
}
function ${prefix}updateButton(value){
${prefix}toggleButtonValue=value;
if(${prefix}toggleButtonValue){$('#${prefix}btn_Freezer').text('${btnText2}')}
else{$('#${prefix}btn_Freezer').text('${btnText1}')}
}
fxConfigUpdaters[${idx}]=function(cfg){
console.log('browserD-sendConfigUpdate->freeze got cfg: ');
console.log(cfg);
${prefix}updateButton(cfg.frozen)
}
${prefix}updateButton(${this.frozen})
</script>
`
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
			// layout changed since start of freeze?
			if (this.layout.fxLength != this.lastColors.length) {
				self.logger.warn("FX: Freeze: resizing necessary! " + this.lastColors.length + " -> " + this.layout.fxLength)
				this.lastColors = util.mergeColors(this.layout.fxLength, this.lastColors)
			}
			return util.mergeColors(this.layout.canvasSize, canvas, this.lastColors, this.layout.canvasStart)
		} else {
			this.lastColors = canvas.slice(this.layout.canvasStart, this.layout.fxLength)
			return canvas
		}
    },
    
}
	return self
}
