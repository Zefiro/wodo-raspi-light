var util = require('./fx_util')
var dict = require("dict")

module.exports = function(layout, name) { return {

    // FX configuration
    layout: layout,
	variables: dict({a:0,value:0}),	
    
    getName: function() {
        return "color shift"
    },
    
    getConfigHtml: function(idx) {
        return "<b>I'm a configuration</b> for " + this.getName() + "<br>"
    },
    
    renderColors: function(inputColors, variables) {
		// variables
		a = variables.get('transpose').get('a')
		a = a < 512 ? a+5 : 0
		value = a > 255 ? 512 - a : a
value = 0;
		variables.get('transpose').set('a', a)
		variables.get('transpose').set('value', value)
		// colors
        colors = []
		value = variables.get('transpose').get('value')
        for(var i = 0; i < this.layout.fxLength; i++ ) {
            col = inputColors[0][i]
            colors[i] = { r: util.map(col.r, 128, value), g: util.map(col.g, 255, value), b: util.map(col.b, 0, value) }
        }
    	return colors
    },
    
}}
