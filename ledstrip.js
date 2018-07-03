#!/usr//bin/node

var ws281x = require('node-rpi-ws281x-native')
var app = require('express')()
var fs = require('fs')
var Q = require('q')
var http = require('http').Server(app)
var io = require('socket.io')(http, { })
var util = require('./fx/fx_util')
var dict = require("dict")

const TARGET_FPS = 50

var NUM_LEDS = parseInt(process.argv[2], 10) || 50
var colors = new Array(NUM_LEDS)
var fxList = []

// available effects for the user to select
// Unfinished Effects: dmx, transpose, merge, combine, shippo
var fxNames = ['disco', 'rainbow', 'singleColor', 'fire', 'shadowolf', 'alarm', 'misan']

// global 'variables' dictionary, each module will have their own (published) variables placed into it
var variables = dict()

logDActivated = false

ws281x.init(NUM_LEDS, { "invert": 1, "frequency": 400000 } )

// ---- trap the SIGINT and reset before exit
process.on('SIGINT', function () {
    console.log("Bye, Bye...")
    ws281x.reset()
    process.nextTick(function () { process.exit(0) })
})

process.on('uncaughtException', function (err) {
    // handle the error safely
    console.log(err.stack)
    ws281x.reset()
    process.nextTick(function () { process.exit(0) })
})

app.use('/', require('express').static(__dirname + '/public'))

app.get('/scenario/:sId', function(req, res) {
	var sId = req.params.sId
	console.log("Scenario requested: " + sId)
	if (sId == "alarm") {
		fxList = []
        fxList[0] = addEffect('freeze').requireIdx([1])
        fxList[1] = addEffect('alarm')
		res.send('Alarm triggered')
	} else if (sId == "alarm2") {
		fxList = []
        fxList[0] = addEffect('freeze').requireIdx([1])
        fxList[1] = addEffect('alarm')
        fxList[1].fx._duration = 200
        fxList[1].fx._speed = 1
		res.send('Alarm2 triggered')
	} else if (sId == "calm") {
		fxList = []
        fxList[0] = addEffect('freeze').requireIdx([1])
        fxList[1] = addEffect('rainbow')
        fxList[1].fx.len = 98
        fxList[1].fx.cyclelen = 600
        fxList[1].fx.speed = 6000
        fxList[1].fx._offset = 50
		res.send('Calming down...')
	} else if (sId == "disco") {
		fxList = []
        fxList[0] = addEffect('freeze').requireIdx([1])
		stripWall = addEffect('disco')
		stripWall.fx.numLeds = 57
		stripWindow = addEffect('disco')
		stripWindow.fx.numLeds = 41
		stripMerge = addEffect('merge')
		stripMerge.fx.s_indexes = [ 2, 3 ]
		stripMerge.fx.s_length = stripWindow.fx.numLeds
		stripMerge.fx.s_start = stripWall.fx.numLeds

		fxList[1] = stripMerge
		fxList[2] = stripWall
		fxList[3] = stripWindow
		res.send('Let\'s rock!')
	} else if (sId == "load") {
		doCfgLoad()
		res.send('Stored Scenario loaded')
	} else {
     	console.log("Scenario not found: " + sId)
		res.status(404).send('Scenario not found: ' + sId)
	}
});

app.get('/client/:clientId', function(req, res) {
	var clientId = req.params.clientId
	var clientData = variables.get('Client' + clientId).get('clientData')
	console.log("Client requested update: " + clientId + ", gets: '" + clientData + "'")
	res.send(clientData);
});

http.listen(80, function(){
  console.log('listening on *:80')
})

function sendFullConfig() {
	console.log("Resending config to all clients")
    html = "<h3>Configuration</h3>"
    for(var idx = 0; idx < fxList.length; idx++) {
        html += util.fxgroup(idx, fxList[idx].fx)
    }
	html += util.fxselect(fxNames, fxList)
    io.emit('fxConfigRead', html)
}

var latestClientId = 0;
function getNewClientId() {
	return ++latestClientId
}

var socket = {}

io.on('connection', function(s) {
  socket = s
  var clientId = getNewClientId()
  console.log('a user connected from ' + socket.client.conn.remoteAddress + ", clientId=" + clientId)

  socket.on('fxClientId', function(data){
    socket.emit('fxClientId', clientId)
  })
  
  socket.on('fxConfigRead', function(data){
    sendFullConfig()
  })
  
  socket.on('zconListRead', function(data) {
	  configManager.zconListRead(socket, data)
  })
  
  socket.on('fxConfigWrite', function(data){
    dataOut = []
    for(var idx = 0; idx < data.length; idx++) {
		var fxIdx = data[idx].fx
		var cfg = data[idx].cfg
		var fx = fxList[fxIdx].fx
		// TODO compare ID if it's still an active effect, silently ignore otherwise
		fx.setConfigData(cfg)
		dataOut.push({fx:fxIdx,id:0,clientId:clientId,cfg:cfg})
    }
    io.emit('fxConfigWrite', dataOut)
	
	console.log("Sent to clients:"); console.log(dataOut)
  })

  socket.on('setFx', function(data) {
    console.log("setFx("+data+")")
    // TODO only for "Regalbrett"
    if (false && fxNames[data] === "disco") {
        fullDisco();
    } else {
		fxList.length = 1 // safest way to keep the same object, but get rid of additional effects
// only for ZCon
//        fxList[0] = addEffect('fx_rfid').requireIdx([1])
        fxList[0] = addEffect('freeze').requireIdx([1])
        fxList[1] = addEffect(fxNames[data])
    }
    sendFullConfig()
  })

  socket.on('fxColorRead', function(msg){
    data = { c: [] }
    for(var idx = 0; idx < colors.length; idx++) {
        data.c[idx] = util.rgb2html(colors[idx])
    }
    socket.emit('fxColorRead', data)
  })

  socket.on('disconnect', function(){
    console.log('user disconnected, clientId=' + clientId)
  })

  socket.on('cfgDoSave', function(msg){
    doCfgSave(socket, msg)
  })

  socket.on('cfgDoLoad', function(msg){
    doCfgLoad(socket, msg)
  })

})

/* Idea for better implementation of cfg send
cfgio = []
//new client
cfgio[clientId] = { 'socket': socket, 'rcv_window': default, 'rcv_Id': 0, 'cfgToSend': {} }
// dropped client
cfgio[clientId] = undefined
// configchange (from browser or elsewhere, if elsewhere clientId < 0)
ValidateAndSetConfig(cfg[]) && emitConfig(validated_cfg[], clientId)
  loop 0..latestClientId, which still exist
    rcv_window > 0 ?
      rcv_window--
      rcv_id++
      socket.emit(cfg + rcd_id)
    else
      cfgToSend = mergewith(cfgToSend, cfg) // this merges and if necessary overwrites (based on fx id)
// cfg ACK (needs to be newly send from browser)
cfgToSend?
  rcv_id++
  socket.emit(cfgToSend)
  cfgToSend == undefined
else
  rcv_window++ & upper bound for safety (log if reached)
// config structure changed
sendFullConfig
  loop 0..latestClientId, which still exist
    rcv_window = default
    rcv_id = 0
    cfgToSend == undefined


*/  

var configManager = {
	update: function() {
	sendFullConfig();
	},
	updateUsers: function() {
		configManager.zconListRead(io, {})
	},
	variables: variables,
	fxList: fxList,
	addEffect: addEffect,
	toast: function(txt) {
		if (io) {
			console.log("Toasting: " + txt)
			io.emit("toast", txt)
		}
	},
	zconListRead: function() {}
}

function addEffect(fxName, fxVarName) {
    if (!fxVarName) fxVarName = fxName
    console.log("adding effect " + fxName + " as " + fxVarName + " (" + NUM_LEDS + ")")
	effect = require('./fx/' + fxName)(NUM_LEDS, configManager, socket)
	variables.set(fxVarName, effect.variables)
    return {
        name: fxName,
        fx: effect,
		requireIdx: function(idx) {
            this.fx._inputIndexes = Array.isArray(idx) ? idx : [idx]
            return this
        },
    }
}

function logD(obj) {
    if (logDActivated) {
        console.log(obj)
    }
}

var cfgFilename = "ledstrip.conf"
function doCfgSave(socket, msg) {
    console.log("Save triggered...")
    var config = {
        _comment: "Saved configurations for Ledstrip.js",
        fxList: []
    }
    for (var i = 0; i < fxList.length; i++) {
        var fxCfg = fxList[i].fx.saveConfigData()
        config.fxList[i] = {
            name: fxList[i].name,
            cfg: fxCfg,
        }
    }
    var p=Q.nfcall(fs.writeFile, cfgFilename, JSON.stringify(config, null, 4), {encoding: 'utf-8'})
    p.fail(function () {
        console.log("Failed to write config file " + cfgFilename)
        socket.emit("toast", "Failed to write config")
    })
    p.then(function () {
        socket.emit("toast", "Config saved")
    })
}

function doCfgLoad(socket, msg) {    
    console.log("Load triggered...")
    var p=Q.nfcall(fs.readFile, cfgFilename, {encoding: 'utf-8'})
    p.fail(function () {
        console.log("Failed to read config file " + cfgFilename)
        socket && socket.emit("toast", "Failed to read config")
    })
    p.then(function (data) {
        var config = JSON.parse(data)
        fxList = []
        for(var i = 0; i < config.fxList.length; i++) {
            var fx = addEffect(config.fxList[i].name)
            var cfg = config.fxList[i].cfg
            fx.fx.loadConfigData(cfg)
            fxList.push(fx)
        }
        sendFullConfig()
        socket && socket.emit("toast", "Config loaded")
    })
}

// used by renderColors() and renderAllColors()
var tempColors = []

function renderAllColors() {
	for(idx = fxList.length-1; idx >= 0; idx--) {
		if (fxList[idx] === undefined) {
			logD("renderAllColors: undefined fx[" + idx + "], default to black")
			tempColors[idx] = util.mergeColors(NUM_LEDS)
			continue
		}
		var inputIdxList = fxList[idx].fx.getInputIndexes()    
    	var inputColors = []
		for(var i = 0; i < inputIdxList.length; i++ ) {
			var inputIdx = inputIdxList[i]
			if (inputIdx == idx) {
				logD("renderAllColors: input #" + i + " is fx #" + inputIdx + " -> it's us! use black")
				tempColors[inputIdx] = util.mergeColors(NUM_LEDS)
			} else if (tempColors[inputIdx] === undefined) {
				logD("renderAllColors: input #" + i + " is fx #" + inputIdx + " -> not defined yet, use black (effects may only use inputs deeper down in the stack)")
				tempColors[inputIdx] = util.mergeColors(NUM_LEDS)
			}
			inputColors[i] = tempColors[inputIdx]
			logD("inputColors now defined:")
	//        console.log(inputColors)
		}
		logD("renderAllColors: calling fx[" + idx + "] '"+fxList[idx].fx.getName()+"' with inputs: " + inputIdxList)
		tempColors[idx] = fxList[idx].fx.renderColors(inputColors, variables)
	}
}

function renderColors() {
    tempColors = []
	renderAllColors()
    return util.mergeColors(NUM_LEDS, tempColors[0])
}





var pixelData = new Uint32Array(NUM_LEDS)
var fps_lastDate = new Date()
var fps_smoothed = 1000 / TARGET_FPS

// only add effects and start rendering, when socket is loaded. pass socket to effect module
function startRendering() {
    var timerId = setInterval(function () {
        fps_currentDate = new Date()
        timediff = fps_currentDate - fps_lastDate
        fps_lastDate = fps_currentDate
        fps_smoothed = (fps_smoothed * 31 + timediff) / 32
        
        logD("Timer: render all colors")
        colors = renderColors()
        // set the colors
        if (colors === undefined || colors.length != NUM_LEDS) {
            console.log("colors is undefined or of wrong length! Aborting!")
            process.exit(1)
        }
        for(var i=0; i<NUM_LEDS; i++) { 
            pixelData[i] = util.rgb2Int(colors[i].r, colors[i].g, colors[i].b)
        }
        ws281x.render(pixelData)
        
    //    console.log("\033[1A" + Math.round(1000 / fps_smoothed) + " / " + (new Date() - fps_currentDate) + " ")
    }, 1000 / TARGET_FPS)
}




// scene setting for disco effect on 'Regalbrett'
function fullDisco() {
    stripWall = addEffect('disco')
    stripWall.fx.numLeds = 57
    stripWindow = addEffect('disco')
    stripWindow.fx.numLeds = 41
    stripMerge = addEffect('merge')
    stripMerge.fx.s_indexes = [ 2, 3 ]
    stripMerge.fx.s_length = stripWindow.fx.numLeds
    stripMerge.fx.s_start = stripWall.fx.numLeds

    fxList[1] = stripMerge
    fxList[2] = stripWall
    fxList[3] = stripWindow
}

console.log('Press <ctrl>+C to exit.')


if (true) {
    // only for ZCon
    fxList[0] = addEffect('fx_rfid').requireIdx([1])
    fxList[1] = addEffect('fire')
    fxList[2] = addEffect('Client', 'Client1')
    fxList[3] = addEffect('Client', 'Client2')
} else {
    doCfgLoad()
}

startRendering()
