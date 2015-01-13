module.exports = {

    map: function(a, b, procent) {
        return Math.floor((a * (100-procent) + b * procent) / 100)
    },

    mapColor: function(col1, col2, procent) {
        var result = {r: 0, g: 0, b: 0}
        result.r = this.map(col1.r, col2.r, procent)
        result.g = this.map(col1.g, col2.g, procent)
        result.b = this.map(col1.b, col2.b, procent)
        return result
    },
    
    htmlRead_Integer: function(id, value, desc) {
        return "<input id='" + id + "' value='" + value + "'> " + desc
    },
	
    fxselect: function(fxNames, fxList) {
		html = '<div><b>Select effect:</b><select id="addFxSelector">'
		for(var idx = 0; idx < fxNames.length; idx++) {
			var selected = (fxList[1].name == fxNames[idx]) ? " selected" : ""
			html += '<option value="' + idx + '"'+selected+'>' + fxNames[idx] + '</option>'
		}
		html += '</select></div>'
		html += '<script>"use strict";$("#addFxSelector").change(function(){console.log("addFxSelector"+$("#addFxSelector").val());socket.emit("setFx",$("#addFxSelector").val())})</script>'
		return html
	},
	
	fxgroup: function(idx, fx) {
		html = "<b>FX:</b> " + fx.getName() + "<br>"
		html += fx.getConfigHtml(idx)
		html += '<hr>'
		return html
	}
}
