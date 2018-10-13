var util = require('./fx_util')
var dict = require("dict")

module.exports = function(layout, configManager) { return {

    // FX configuration
	layout: layout,
	_configManager: configManager,
    
	variables: dict({
		color: util.rgb(0, 0, 0),
	}),

    getName: function() {
        return "Displays a single color"
    },
	
    getConfigHtml: function(idx) {
		var color = this.variables.get("color")
		var prefix = "fx" + idx
//console.log("getConfigHtml("+idx+")")
		html  = "<style>."+prefix+"_colBtn span{width:40px;height:40px;display:inline-block;margin:5px}</style>\n"
        html += "<div style='float:left;padding-left:30px;'>\n"
		html += "<div id='"+prefix+"_color_red' style='width:300px;background:#FF0000'></div>&nbsp;&nbsp;&nbsp;\n"
        html += "<div id='"+prefix+"_color_green' style='width:300px;background:#00FF00'></div>&nbsp;&nbsp;&nbsp;\n"
        html += "<div id='"+prefix+"_color_blue' style='width:300px;background:#0000FF'></div>&nbsp;&nbsp;&nbsp;\n"
		html += "</div><div  style='float:right' class='"+prefix+"_colBtn'>\n"
		var predefColors = ['#000000','#FFFFFF',
			'#0000FF','#00FF00','#FF0000','#00FFFF','#FFFF00','#FF00FF']
		for(var colIdx = 0; colIdx < predefColors.length; colIdx++) {
			html += "<span style='background-color:"+predefColors[colIdx]+";' onclick='"+prefix+"_useColor(this)'></span>\n"
		}
		html += "</div><br style='clear:both'>\n"
        html += "<script>\n\
"+prefix+"_noUpdate=true;\n\
function "+prefix+"_useColor(obj) {\n\
	var col=hex2rgb($(obj).css('background-color'));\n\
	"+prefix+"_setColor(col);\n\
	"+prefix+"_singleColor();\n\
}\n\
function "+prefix+"_setColor(col) {\n\
    "+prefix+"_noUpdate=true;\n\
	$('#"+prefix+"_color_red').slider('option','value',col.r);\n\
	$('#"+prefix+"_color_green').slider('option','value',col.g);\n\
	$('#"+prefix+"_color_blue').slider('option','value',col.b);\n\
	"+prefix+"_noUpdate=false;\n\
};\n\
$(function(){\n\
	o={min:0,max:255,change:"+prefix+"_singleColor,slide:"+prefix+"_singleColor};\n\
	a=$('#"+prefix+"_color_red');a.slider(o);a.slider('option','value',"+color.r+");\n\
	a=$('#"+prefix+"_color_green');a.slider(o);a.slider('option','value',"+color.g+");\n\
	a=$('#"+prefix+"_color_blue');a.slider(o);a.slider('option','value',"+color.b+");\n\
	"+prefix+"_noUpdate=false;\n\
	fxConfigUpdaters["+idx+"]=function(cfg){\n\
		console.log('browserD-sendConfigUpdate->singleColor got cfg: ');\n\
		console.log(cfg);\n\
		"+prefix+"_setColor(cfg.color)\n\
	}\n\
});\n\
function "+prefix+"_singleColor() {\n\
    if("+prefix+"_noUpdate){return;}\n\
//	console.log('singleColor called');\n\
	var red = parseInt($('#"+prefix+"_color_red').slider('option','value'));\n\
	var green = parseInt($('#"+prefix+"_color_green').slider('option','value'));\n\
	var blue = parseInt($('#"+prefix+"_color_blue').slider('option','value'));\n\
	var cfg = [{fx:"+idx+",id:0,cfg:{color:{r: red, g: green, b: blue}}}];\n\
	socket.emit('browser-sendConfigUpdate', cfg);\n\
}"
	html += "</script>\n"
		return html
    },
	
	getConfigData: function() {
		return { color: this.variables.get('color') }
	},
	
	setConfigData: function(data) {
		console.log("singleColor.setConfigData:")
		console.log(data)
		this.variables.set('color', data.color)
	},
    
	saveConfigData: function() {
		return { color: this.variables.get('color') }
	},
	
	loadConfigData: function(data) {
		this.variables.set('color', data.color)
	},
    
    renderColors: function(canvas, variables) {
		var color = this.variables.get('color')
		for(var i = 0; i < this.layout.fxLength; i++) {
			canvas[this.layout.canvasStart + i] = color
		}
    	return canvas
    },
    
}}
