var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
    numLeds: _numLeds,
	lastColors: [],
	frozen: false,
    
    getInputIndexes: function() {
        return [1]
    },
    
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
		console.log("freeze.setConfigData:")
		console.log(data)
		this.frozen = data.frozen
	},
    
    renderColors: function(inputColors) {
        if (!this.frozen) {
			this.lastColors = inputColors[0]
		}
    	return this.lastColors
    },
    
}}
