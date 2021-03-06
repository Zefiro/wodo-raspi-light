module.exports = {
    clone: require('clone'),
	
    /** Returns an integer between min..max (inclusive) */
    getRandomInt: function(min, max) {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /** Returns a value between a and b, linearly depending on procent, with procent=0 -> a and procent=100 -> b */
    map: function(a, b, procent) {
        procent = Math.min(100, Math.max(0, procent))
        return Math.floor((a * (100-procent) + b * procent) / 100)
    },

    /** Returns an int value between a and b, linearly depending where z is between x and y */
    map2: function(a, b, x, y, z) {
		if (z <= x) return a
		if (z >= y) return b
		return Math.floor((b - a) * (z - x) / (y - x) + a)
    },

    /** Returns a color, linearly mapped in RGB space between col1 and col2, with procent 0..100 */
    mapColor: function(col1, col2, procent) {
        var result = {r: 0, g: 0, b: 0}
        result.r = this.map(col1.r, col2.r, procent)
        result.g = this.map(col1.g, col2.g, procent)
        result.b = this.map(col1.b, col2.b, procent)
        return result
    },
	
	mapLifecycle: function(lifecycle, index) {
		if (lifecycle[0][0] >= index) return lifecycle[0][1]
		if (lifecycle[lifecycle.length-1][0] <= index) return lifecycle[lifecycle.length-1][1]
		let i = 0
		// this gives an "i" which is above (or same as) "index", and i>0
		while (i < lifecycle.length && lifecycle[i][0] < index) i++
		if (lifecycle[i][0] == index) return lifecycle[i][1]
		let di = lifecycle[i][0] - lifecycle[i-1][0]
		let di2 = 100 * (index - lifecycle[i-1][0]) / di
		return this.map(lifecycle[i-1][1], lifecycle[i][1], di2)
	},
	
	/** Returns an array of colors of length targetLength based on copying newColors onto existingColors starting at index startIndex. Missing colors are filled with black.
	 *  Usage to ensure a certain length: mergeColors(targetLength, colors)
	 *  Usage to just return all black: mergeColors(targetLength)
	 */
	mergeColors: function(targetLength, existingColors, newColors, startIndex) {
        var defaultColor = {r: 0, g: 0, b: 0}
		if (newColors === undefined) newColors = []
		if (startIndex === undefined) startIndex = 0
		if (existingColors === undefined) existingColors = []
		for(var i = existingColors.length; i < targetLength; i++) {
			existingColors[i] = defaultColor
		}
        var prefix = existingColors.slice(0, startIndex)
        var postfix = existingColors.slice(startIndex + newColors.length)
        var result = prefix.concat(newColors, postfix)
        result = result.slice(0, targetLength)
		return result
    },
	
	setCanvasColors: function(canvas, layout, idx, colors) {
		for(let i = 0; i < colors.length; i++) {
			let targetIdx = layout.canvasStart + (layout.reverse ? layout.fxLength - idx - i - 1 : idx + i)
			if (targetIdx >= layout.canvasStart && targetIdx < layout.canvasStart + layout.fxLength) {
				canvas[targetIdx] = colors[i]
			}
		}
	},
    
    rgb2html: function(col) {
        return "#" + ((1 << 24) + (col.r << 16) + (col.g << 8) + col.b).toString(16).slice(1);
    },

    html2rgb: function(html) {
        var result = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/i.exec(html);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
	
    rgb: function(r, g, b) {
        return {
            r: r,
            g: g,
            b: b
        }
    },

    /** returns the 32bit int representation of the r,g,b color.
     * Note: ensures that b != 255 as this triggers a special mode in the ALDI led strip
     */
    rgb2Int: function(r, g, b) {
        if (b == 255) { b = 254 }
        return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff)
    },

    /** returns HTML for an input field reading an integer */
    htmlRead_Integer: function(id, value, desc) {
        return "<input id='" + id + "' value='" + value + "'> " + desc
    },
	
    // TODO hardcoded dropdown based on effect 1 (assuming effect 0 is 'freeze')
    fxselect: function(fxNames, fxList) {
		var selectedFx = fxList && fxList[1] ? fxList[1].name : ''
		var html = '<div><b>Select effect:</b><select id="addFxSelector">'
		for(var idx = 0; idx < fxNames.length; idx++) {
			var selected = (selectedFx == fxNames[idx]) ? " selected" : ""
			html += '<option value="' + idx + '"'+selected+'>' + fxNames[idx] + '</option>'
		}
		html += '</select></div>'
		html += '<script>"use strict";$("#addFxSelector").change(function(){console.log("addFxSelector"+$("#addFxSelector").val());socket.emit("browser-setFx",$("#addFxSelector").val())})</script>'
		return html
	},
	
	/** returns the HTML for the configuration of effect fx, as defined by this effect and wrapped in a box */
	fxgroup: function(idx, fx) {
		var html = "<b>FX:</b> " + fx.getName() + "<br>\n"
		html += fx.getConfigHtml(idx)
		html += '<hr>\n\n'
		return html
	},
	
	/** returns HTML configuration fields based on metadata */
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
			if (cfg.type === 'text') { // static text
				controls_html.push(cfg.desc)
			} else if (cfg.type === 'dynamictext') { // readonly, dynamic text
				controls_html.push((cfg.name ? "<b>" + cfg.name + ":</b>&nbsp;" : "") + "<span id='" + prefix + cfg.id + "'/> " + cfg.desc)
				scriptinit.push("\
	$('#"+prefix+cfg.id+"').html('"+config[cfg.id]+"')\n\
")
				scriptupdate.push("\
			$('#"+prefix+cfg.id+"').html(cfg."+cfg.id+")\n\
")
			} else if (cfg.type === 'string') {
				controls_html.push("<b>" + cfg.name + ":</b>&nbsp;<input type='text' id='" + prefix + cfg.id + "'> " + cfg.desc)
				scriptinit.push("\
	$('#"+prefix+cfg.id+"').val('"+config[cfg.id]+"')\n\
	$('#"+prefix+cfg.id+"').change("+prefix+"valueChange)\n\
")
				scriptupdate.push("\
			$('#"+prefix+cfg.id+"').val(cfg."+cfg.id+")\n\
")
				scriptwrite.push("\
			var "+cfg.id+" = $('#"+prefix+cfg.id+"').val();\n\
")
				scriptconfig.push(cfg.id + ":" + cfg.id)
			} else if (cfg.type === 'int') {
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
			} else if (cfg.type === 'combo') {
				controls_html.push("<b>" + cfg.name + ":</b>&nbsp;<select id='" + prefix + cfg.id + "'>")
				Object.keys(cfg.combo).forEach(function(key) {
        			controls_html.push("<option value='"+key+"'>"+cfg.combo[key]+"</option>")
			    })
				controls_html.push("</select>&nbsp;&nbsp;" + cfg.desc)
				scriptinit.push("\
	$('#"+prefix+cfg.id+"').val('"+config[cfg.id]+"')\n\
	$('#"+prefix+cfg.id+"').change("+prefix+"valueChange)\n\
")
				scriptupdate.push("\
			$('#"+prefix+cfg.id+"').val(cfg."+cfg.id+")\n\
")
				scriptwrite.push("\
			var "+cfg.id+" = $('#"+prefix+cfg.id+"').val();\n\
")
				scriptconfig.push(cfg.id + ":" + cfg.id)
			} else if (cfg.type === 'button') {
				controls_html.push("<button type='button' id='" + prefix + cfg.id + "_btn'>" + cfg.name + "</button><input type='hidden' id='" + prefix + cfg.id + "'> " + cfg.desc)
				scriptinit.push("\
	$('#"+prefix+cfg.id+"').val("+config[cfg.id]+")\n\
	$('#"+prefix+cfg.id+"').change("+prefix+"valueChange)\n\
	$('#"+prefix+cfg.id+"_btn').click(function(){$('#"+prefix+cfg.id+"').val(1);"+prefix+"valueChange()})\n\
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
		"+prefix+"noUpdate=true;\n\
		console.log('browserD-sendConfigUpdate->" + metaconfig.name + " got cfg: ');\n\
		console.log(cfg);\n"
		html += scriptupdate.join("")
		html += "\
		"+prefix+"noUpdate=false;\n\
	}\n\
})\n\
function "+prefix+"valueChange() {\n\
    if("+prefix+"noUpdate){return;}\n\
	console.log('"+prefix+"valueChange called');\n"
	html += scriptwrite.join("")
	html += "\
	var cfg = [{fx:"+fxIdx+",id:0,cfg:{"+scriptconfig.join(',')+"}}];\n\
	socket.emit('browser-sendConfigUpdate', cfg);\n\
}\n\
</script>\n"
		return html
	},
}
