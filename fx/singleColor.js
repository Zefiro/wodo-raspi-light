var util = require('./fx_util')

module.exports = function(_numLeds) { return {

    // FX configuration
    numLeds: _numLeds,
	color: { r: 0, g: 0, b: 0 },
    
    getInputIndexes: function() {
        return [3]
    },
    
    getName: function() {
        return "Displays a single color"
    },
	
    getConfigHtml: function(idx) {
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
	a=$('#"+prefix+"_color_red');a.slider(o);a.slider('option','value',"+this.color.r+");\n\
	a=$('#"+prefix+"_color_green');a.slider(o);a.slider('option','value',"+this.color.g+");\n\
	a=$('#"+prefix+"_color_blue');a.slider(o);a.slider('option','value',"+this.color.b+");\n\
	"+prefix+"_noUpdate=false;\n\
	fxConfigUpdaters["+idx+"]=function(cfg){\n\
		console.log('fxConfigWrite->singleColor got cfg: ');\n\
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
	socket.emit('fxConfigWrite', cfg);\n\
}"
	html += "</script>\n"
		return html
    },
	
	getConfigData: function() {
		return { color: this.color }
	},
	
	setConfigData: function(data) {
		console.log("singleColor.setConfigData:")
		console.log(data)
		this.color = data.color
	},
    
	saveConfigData: function() {
		return { color: this.color }
	},
	
	loadConfigData: function(data) {
		this.color = data.color
	},
    
    renderColors: function(inputColors, variables) {
        var colors = []
		for(var idx=0; idx < this.numLeds; idx++) {
			colors[idx] = this.color
		}
    	return colors
    },
    
}}
