var util = require('./fx_util')

module.exports = function(_numLeds, name) { return {

    // FX configuration
    numLeds: _numLeds,
    transparency: 0,
    _inputIndexes: [],
    
    getInputIndexes: function() {
        return this._inputIndexes
    },
    
    getName: function() {
        return "effect fadeover"
    },
    
    getConfigHtml: function(idx) {
        html = "<b>FX:</b> " + this.getName() + "<br>"
        html += util.htmlRead_Integer('inputIdx0_'+idx, this.inputIndexList[0], "Index of effect Input #1")
        html += "<br>"
        html += util.htmlRead_Integer('inputIdx1_'+idx, this.inputIndexList[1], "Index of effect Input #2")
        html += "<br>"
        return html
    },
    
    renderColors: function(inputColors) {
        colors = []
        for(var i = 0; i < this.numLeds; i++ ) {
            colors[i] = util.mapColor(inputColors[0][i], inputColors[1][i], this.transparency)
        }
    	return colors
    },
    
}}
