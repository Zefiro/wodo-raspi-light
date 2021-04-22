var util = require('./fx_util')
const fetch = require('node-fetch')

module.exports = function(layout, name, god) { return {

    // FX configuration
    layout: layout,
    macros: [{
      speed: 2,
      steps: [
        "............",
        "............",
    ]},{
      speed: 2,
      steps: [
        "...R.....R..",
        "............",
        "R.....R.....",
        "............",
        "R..R..R..R..",
        "............",
    ]},{
      speed: 2,
      steps: [
        ".G.....G....",
        "....G.....G.",
        ".G.....G....",
        "....G.....G.",
        ".G.....G....",
        "....G.....G.",
    ]},{
      speed: 2,
      steps: [
        "..B.........",
        ".....B......",
        "........B...",
        "...........B",
        "........B..B",
        "..B..B......",
    ]},{
      speed: 2,
      steps: [
        "R.....R.....",
        "...R.....R..",
        ".G..G.......",
        ".......G..G.",
        "R.....R.....",
        "...R.....R..",
        ".G..G.......",
        ".......G..G.",
        "..B..B..B..B",
        "............",
    ]},{
      speed: 2,
      steps: [
        ".W.W.W.W.W.W",
        "............",
/*    ]},{
      speed: 6,
      steps: [
        "Y..........Y",
        ".Y........Y.",
        "..Y......Y..",
        "...Y....Y...",
        "....Y....Y..",
        "Y....Y....Y.",
        ".Y....Y....Y",
        "..Y....Y....",
        "...Y....Y...",
        "..Y......Y..",
        ".Y........Y.",
        "Y..........Y",
*/    ]}],
    actStep: 0,
    actMacro: 0,
    stepLastTime: new Date().getTime(),
    bpm: 130,
	
    getName: function() {
        return "disco"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'BPM', type: 'int', id: 'bpm', desc: 'beats per minute', css:'width:50px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		return { bpm: this.bpm }
	},
	
	setConfigData: function(data) {
	    this.bpm = data.bpm
            this.stepLastTime = new Date().getTime()
            this.actStep = 0
	},

	saveConfigData: function() {
		return { bpm: this.bpm }
	},
	
	loadConfigData: function(data) {
	    this.bpm = data.bpm
	},

nextTaktOff: 0,
    renderColors: function(canvas) {
		// calculate current step
		stepSpeed = 60 * 1000 / (this.bpm) / this.macros[this.actMacro].speed
		bpmSpeed = 60 * 1000 / (this.bpm) / 4
		var now = new Date().getTime()
		if (this.stepLastTime + stepSpeed <= now) {
		    this.stepLastTime = now
		    this.actStep++
		    if (this.actStep >= this.macros[this.actMacro].steps.length) {
		        this.actStep = 0
		        this.actMacro = util.getRandomInt(0, this.macros.length-1)
//		        console.log("Macro #" + this.actMacro + " (" + this.macros[this.actMacro].steps.length + " steps)")
		    }
if (this.actStep % this.macros[this.actMacro].speed == 0) {
    this.nextTaktOff = now + 60 * 1000 / this.bpm / 2
}
		}
		// display step
		current = this.macros[this.actMacro].steps[this.actStep]
		black = { r: 0, g: 0, b: 0 }
//		console.log(current)
let f = black
		for(i = 0; i < current.length; i++) {
		    j = current.length - i -1 // switch direction, so that config string and actual 'Regalbrett' match
		    switch(current[i]) {
		        case 'R': col = { r: 255, g: 0, b: 0 }; break
		        case 'G': col = { r: 0, g: 255, b: 0 }; break
		        case 'B': col = { r: 0, g: 0, b: 255 }; break
		        case 'Y': col = { r: 255, g: 200, b: 0 }; break
		        case 'W': col = { r: 255, g: 255, b: 255 }; break
		        default: col = black; break
            }
			util.setCanvasColors(canvas, this.layout, i*5, [ col, col, black, black, black ])
			// TODO not just duplicate, but adjust to canvas length
			util.setCanvasColors(canvas, this.layout, i*5+60, [ col, col, black, black, black ])
			if (i > 3 && (col.r != 0 || col.g != 0 || col.b != 0)) f = col
		}
		// this.sendMqtt(f) // NOPE doesn't work :(
// DEBUG bpm display
var taktCol = util.rgb(0, (this.nextTaktOff > now) ? 10 : 0, 0)
canvas[0] = taktCol
//		console.log(this.actStep + " / " + this.steps.length + " / " + (now+1))
    	return canvas
    },
    
	// doesn't work - MQTT is too slow, seems to burst-update once a second, and HTTP also has issues, and crashes the program if too many open requests accumulate
	sendMqtt: async function(color) {
		if (!god.mqtt) return
		let htmlcolor = ("00" + color.r.toString(16)).slice(-2) + ("00" + color.g.toString(16)).slice(-2) + ("00" + color.b.toString(16)).slice(-2)
		console.log(htmlcolor, color)
//		god.mqtt.publish("cmnd/grag-main-fanlight/Color1", "#" + htmlcolor)
console.log('http://grag-main-fanlight.fritz.box/cm?cmnd=Color1 ' + htmlcolor)
//		let res = await fetch('http://grag-main-fanlight.fritz.box/cm?cmnd=Color1 ' + htmlcolor)
//		console.log(res.status)
	},
}}
