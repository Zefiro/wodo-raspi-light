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
	
	mergeColors: function(targetLength, newColors, startIndex, existingColors) {
        var defaultColor = {r: 0, g: 1, b: 0}
		if (newColors === undefined) newColors = []
		if (startIndex === undefined) startIndex = 0
		if (existingColors === undefined) existingColors = []
		for(var i = existingColors.length; i < targetLength; i++) {
			existingColors[i] = defaultColor
		}
		var result = existingColors.slice(0, startIndex).concat(newColors, existingColors.slice(startIndex + newColors.length)).slice(0, targetLength)
		return result
	},
    
    htmlRead_Integer: function(id, value, desc) {
        return "<input id='" + id + "' value='" + value + "'> " + desc
    },
	
    fxselect: function(fxNames, fxList) {
		var html = '<div><b>Select effect:</b><select id="addFxSelector">'
		for(var idx = 0; idx < fxNames.length; idx++) {
			var selected = (fxList[1].name == fxNames[idx]) ? " selected" : ""
			html += '<option value="' + idx + '"'+selected+'>' + fxNames[idx] + '</option>'
		}
		html += '</select></div>'
		html += '<script>"use strict";$("#addFxSelector").change(function(){console.log("addFxSelector"+$("#addFxSelector").val());socket.emit("setFx",$("#addFxSelector").val())})</script>'
		return html
	},
	
	fxgroup: function(idx, fx) {
		var html = "<b>FX:</b> " + fx.getName() + "<br>\n"
		html += fx.getConfigHtml(idx)
		html += '<hr>\n\n'
		return html
	},
	
	generateConfigHtml: function(fxIdx, metaconfig, config) {
		var prefix = "fx" + fxIdx + "_"
		var controls_html = []
		var css = []
		var scriptinit = []
		var scriptupdate = []
		var scriptwrite = []
		var scriptconfig = []
		var c = metaconfig.c
		for(idx = 0; idx < c.length; idx++) {
			var cfg = c[idx]
			cfg.css && css.push("#"+prefix+cfg.id+"{" + cfg.css + "}")
			if (cfg.type === 'int') {
				controls_html.push("<b>" + cfg.name + ":</b>&nbsp;<input type='text' id='" + prefix + cfg.id + "'> " + cfg.desc)
				scriptinit.push("\
	$('#"+prefix+cfg.id+"').val("+config[cfg.id]+")\n\
	$('#"+prefix+cfg.id+"').change("+prefix+"valueChange)\n\
")
				scriptupdate.push("\
			$('#"+prefix+cfg.id+"').val(cfg."+cfg.id+")\n\
")
				scriptwrite.push("\
			var "+cfg.id+" = parseInt($('#"+prefix+cfg.id+"').val());\n\
")
				scriptconfig.push(cfg.id + ":" + cfg.id)
			} else {
				console.log("util.generateConfigHtml: unknown input type '" + cfg.type + "'")
			}
		}
		
		var html = "<style>" + css.join("\n") + "</style>"
		html += controls_html.join("<br>\n")
        html += "\n<script>\n\
var "+prefix+"noUpdate=true;\n\
$(function(){\n"
		html += scriptinit.join("")
		html += "\
	"+prefix+"noUpdate=false;\n\
	fxConfigUpdaters["+fxIdx+"]=function(cfg){\n\
		"+prefix+"_noUpdate=true;\n\
		console.log('fxConfigWrite->" + metaconfig.name + " got cfg: ');\n\
		console.log(cfg);\n"
		html += scriptupdate.join("")
		html += "\
		"+prefix+"_noUpdate=false;\n\
	}\n\
})\n\
function "+prefix+"valueChange() {\n\
    if("+prefix+"noUpdate){return;}\n\
	console.log('"+prefix+"valueChange called');\n"
	html += scriptwrite.join("")
	html += "\
	var cfg = [{fx:"+fxIdx+",id:0,cfg:{"+scriptconfig.join(',')+"}}];\n\
	socket.emit('fxConfigWrite', cfg);\n\
}\n\
</script>\n"
		return html
	},
}
