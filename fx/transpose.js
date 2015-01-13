module.exports = function(_numLeds, name) { return {

    // FX configuration
    numLeds: _numLeds,
    
    getInputIndexes: function() {
        return [3]
    },
    
    getName: function() {
        return "color shift"
    },
    
    getConfigHtml: function(idx) {
        return "<b>I'm a configuration</b> for " + this.getName() + "<br>"
    },
    
    renderColors: function(inputColors) {
        colors = []
        for(var i = 0; i < this.numLeds; i++ ) {
            col = inputColors[0][i]
            colors[i] = { r: col.g, g: col.b, b: col.r }
        }
    	return colors
    },
    
}}
