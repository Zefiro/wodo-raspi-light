#!/usr//bin/node

const ws281x = require('node-rpi-ws281x-native')
const app = require('express')()
const fs = require('fs')
const Q = require('q')
const http = require('http').Server(app)
const io = require('socket.io')(http, { })
const fxutil = require('./fx/fx_util')
const util = require('util')
const dict = require("dict")
const cluster = require('./cluster')()

const TARGET_FPS = 50

const fxList = []
var colors = new Array()

/* TODO
 - clusterC: show that we're a client and disable all input controls (or send them to the master?)
 - clusterD: when we got a client, change canvas size automatically? and back? with a delay?
 - Freeze auf Cluster-Client "springt"

*/


const scenarios = [
	{
		name: 'regalbrett',
		cluster: {
			type: 'server',
		},
		ledCount: 96,
		canvasSize: 136,
	}, {
		name: 'regalbrett2',
		cluster: {
			type: 'client',
			url: 'http://regalbrett.dyn.cave.zefiro.de',
			offset: 96,
			reverse: true,
		},
		ledCount: 40,
		canvasSize: 136,
	}, {
		name: 'zcon',
		ledCount: 50,
		canvasSize: 50,
	}
]

const config = function() {
	for(let i = 0; i < scenarios.length; i++) {
		if (scenarios[i].name == process.argv[2]) {
			var scenario = scenarios[i]
			break
		}
	}
	if (!scenario) {
		console.log("Missing or unknown scenario '" + process.argv[2] + "', please choose one of:")
		scenarios.forEach(scenario => console.log(scenario.name))
		process.exit(1)
	}
	return scenario
}()


// available effects for the user to select
// Unfinished Effects: dmx, transpose, shippo, misan
const fxNames = ['disco', 'rainbow', 'singleColor', 'fire', 'shadowolf', 'alarm']

// global 'variables' dictionary, each module will have their own (published) variables placed into it
const variables = dict()

logDActivated = false

ws281x.init(config.ledCount, { "invert": 1, "frequency": 400000 } )

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

app.get('/scenario/:sId', async function(req, res) {
	var sId = req.params.sId
	console.log("Scenario requested: " + sId)
	if (sId == "alarm") {
		fxList.length = 0
        fxList[0] = addEffect('freeze')
        fxList[1] = addEffect('alarm')
		res.send('Alarm triggered')
	} else if (sId == "alarm2") {
		fxList.length = 0
        fxList[0] = addEffect('freeze')
        fxList[1] = addEffect('alarm')
        fxList[1].fx._duration = 200
        fxList[1].fx._speed = 1
		res.send('Alarm2 triggered')
	} else if (sId == "calm") {
		fxList.length = 0
        fxList[0] = addEffect('freeze')
        fxList[1] = addEffect('rainbow')
        fxList[1].fx.len = 98
        fxList[1].fx.cyclelen = 600
        fxList[1].fx.speed = 6000
        fxList[1].fx._offset = 50
		res.send('Calming down...')
	} else if (sId == "disco") {
		fxList.length = 0
        fxList[0] = addEffect('freeze')
		fullDisco()
		res.send('Let\'s rock!')
	} else if (sId == "green_fire") {
		fxList.length = 0
        fxList[0] = addEffect('freeze')
        fxList[1] = addEffect('fire')
        fxList[1].fx.setConfigData({ color: 'green', type: 'fire' })
		res.send('Green Fire triggered')
	} else if (sId == "blue_fire") {
		fxList.length = 0
        fxList[0] = addEffect('freeze')
        fxList[1] = addEffect('fire')
        fxList[1].fx.setConfigData({ color: 'blue', type: 'fire' })
		res.send('Blue Fire triggered')
	} else if (sId == "load") {
		doCfgLoad()
		res.send('Stored Scenario loaded')
	} else {
     	console.log("Scenario not found: " + sId)
		res.status(404).send('Scenario not found: ' + sId)
	}
	sendFullConfig()
});

app.get('/slave/:slaveId/:type', function(req, res) {
	var slaveIp = req.ip
	var slaveId = req.params.slaveId
	var slaveType = req.params.type
	console.log("Slave #" + slaveId + " (" + slaveIp + ") pinged" + (slaveType ? " (type: " + slaveType + ")" : ""))
	
	var slaveDict = variables.get('Slave' + slaveId)
	slaveDict.set('slaveIp', slaveIp)
	slaveDict.set('slaveId', slaveId)
	slaveDict.set('slaveType', slaveType)
	slaveDict.set('lastPing', Date.now())
	slaveDict.set('lastPushed', 0)
	res.send("ok")
	sendFullConfig()
});

http.listen(80, function(){
  console.log('listening on *:80')
})

function sendFullConfig() {
	console.log("Resending full config to all clients")
	let html = getFullConfigAsHtml()
    io.of('/browser').emit('browserD-sendConfig', html)
	cluster.updateConfig()
}

function getFullConfigAsHtml() {
	let html = "<h3>Configuration</h3>"
    for(var idx = 0; idx < fxList.length; idx++) {
        html += fxutil.fxgroup(idx, fxList[idx].fx)
    }
	html += fxutil.fxselect(fxNames, fxList)
	return html
}

io.of('/browser').on('connection', (socket) => {
  console.log('a user connected from ' + socket.client.conn.remoteAddress + ", socket.id=" + socket.id)

  socket.on('browser-subscribe', () => {
	console.log("Identified as browser: socket.id=" + socket.id)
    socket.emit('browserD-clientId', socket.id)
  })
  
  
  socket.on('browser-requestReadConfig', (data) => {
	console.log("Sending full config to " + socket.id)
	let html = getFullConfigAsHtml()
    socket.emit('browserD-sendConfig', html)
	cluster.updateBrowser()
  })
  
  socket.on('zconListRead', (data) => {
	  configManager.zconListRead(socket, data)
  })
  
  socket.on('browser-sendConfigUpdate', (data) => {
    dataOut = []
    for(var idx = 0; idx < data.length; idx++) {
		var fxIdx = data[idx].fx
		var cfg = data[idx].cfg
		var fx = fxList[fxIdx].fx
		// TODO compare fx if it's still an active effect, silently ignore otherwise
		fx.setConfigData(cfg)
		dataOut.push({fx: fxIdx, cfg: cfg})
    }
	console.log("Got a config update from client.id=%s, sending out to all other clients:", socket.id); console.log(dataOut)
	socket.broadcast.emit('browserD-sendConfigUpdate', dataOut)
	cluster.updateConfig()
  })

  socket.on('browser-setFx', function(data) {
    console.log("browser-setFx("+data+")")
    if (config.name == "regalbrett" && fxNames[data] === "disco") {
        fullDisco();
    } else {
		fxList.length = 1 // safest way to keep the same object, but get rid of additional effects
		if (config.name == "zcon") {
			// keep fxList[0] unchanged, as it holds state
			fxList[1] = addEffect(fxNames[data])
			fxList[2] = addEffect('slave', 'Slave1')
		} else {
			fxList[0] = addEffect('freeze')
			fxList[1] = addEffect(fxNames[data])
		}
    }
    sendFullConfig()
  })

  socket.on('browser-requestPreview', function(msg){
    data = { c: [] }
    for(var idx = 0; idx < config.ledCount; idx++) {
        data.c[idx] = fxutil.rgb2html(colors[idx])
    }
    socket.volatile.emit('browserD-sendPreview', data)
  })

  socket.on('disconnect', function(data){
    console.log('user disconnected, client.id=' + socket.id)
	console.log(data)
  })

  socket.on('browser-cfgDoSave', function(msg){
    doCfgSave(socket, msg)
  })

  socket.on('browser-cfgDoLoad', async function(msg){
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
	sendToBrowser: function(id, data) {
	    io.of('/browser').emit(id, data)
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
    console.log("adding effect " + fxName + " as " + fxVarName + " (" + config.canvasSize + ")")
	let layout = {
		// size of the full canvas (i.e. the array of calculated colors, which is used for other effects and finally to drive the LEDs)
		canvasSize: config.canvasSize,
		// size of the effect calculation. May differ from the canvas size
		fxSize: config.canvasSize,
		// size of the effect to be calculated. May be smaller than effectSize
		fxLength: config.ledCount,
		// where on the effect calculation space the actual effect subset should be started
		fxStart: 0,
		// where on the canvas to start placing the effect
		canvasStart: 0,
		// whether placement of the effect on the canvas should be done reversed
		reverse: false,
	}
	effect = require('./fx/' + fxName)(layout, configManager)
	variables.set(fxVarName, effect.variables)
    return {
        name: fxName,
		varName: fxVarName,
        fx: effect,
    }
}

function logD(obj) {
    if (logDActivated) {
        console.log(obj)
    }
}

var cfgFilename = "ledstrip.conf"
async function doCfgSave(socket, msg) {
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
	let writeFile = util.promisify(fs.writeFile)
	try {
        await writeFile(cfgFilename, JSON.stringify(config, null, 4), {encoding: 'utf-8'})
        socket.emit("toast", "Config saved")
	} catch (error) {
        console.log("Failed to write config file " + cfgFilename + ": " + error)
        socket.emit("toast", "Failed to write config")
	}
}

async function doCfgLoad(socket, msg) {    
    console.log("Load triggered...")
	let readFile = util.promisify(fs.readFile)
	try {
		let data = await readFile(cfgFilename, {encoding: 'utf-8'})
        var config = JSON.parse(data)
        fxList.length = 0
        for(var i = 0; i < config.fxList.length; i++) {
            var fx = addEffect(config.fxList[i].name)
            var cfg = config.fxList[i].cfg
            fx.fx.loadConfigData(cfg)
            fxList.push(fx)
        }
		console.log("Config loaded: " + fxList.length + " effects")
        sendFullConfig()
        socket && socket.emit("toast", "Config loaded")
	} catch (error) {
        console.log("Failed to read config file " + cfgFilename + ": " + error)
        socket && socket.emit("toast", "Failed to read config")
    }
}

function renderColors() {
    let canvas = fxutil.mergeColors(config.canvasSize)
	for(idx = fxList.length-1; idx >= 0; idx--) {
		if (fxList[idx] === undefined) {
			logD("renderColors: undefined fx[" + idx + "], ignoring")
			continue
		}
		logD("renderColors: calling fx[" + idx + "] '" + fxList[idx].fx.getName())
		canvas = fxList[idx].fx.renderColors(canvas, variables)
	}
	
    return fxutil.mergeColors(config.canvasSize, canvas)
}





var pixelData = new Uint32Array(config.ledCount)
var fps_lastDate = new Date()
var fps_smoothed = 1000 / TARGET_FPS

function startRendering() {
    var timerId = setInterval(function () {
        fps_currentDate = new Date()
        timediff = fps_currentDate - fps_lastDate
        fps_lastDate = fps_currentDate
        fps_smoothed = (fps_smoothed * 31 + timediff) / 32
        
        logD("Timer: render all colors")
        colors = renderColors()
        // set the colors
        if (colors === undefined || colors.length != config.canvasSize) {
            console.log("colors is undefined or of wrong length! Aborting!")
            process.exit(1)
        }
        for(let i = 0; i < config.ledCount; i++) { 
            pixelData[i] = fxutil.rgb2Int(colors[i].r, colors[i].g, colors[i].b)
        }
        ws281x.render(pixelData)
        
    //    console.log("\033[1A" + Math.round(1000 / fps_smoothed) + " / " + (new Date() - fps_currentDate) + " ")
    }, 1000 / TARGET_FPS)
}




// scene setting for disco effect on 'Regalbrett'
function fullDisco() {
    stripWall = addEffect('disco', 'disco1')
    stripWall.fx.layout.canvasStart = 0
    stripWall.fx.layout.fxLength = 57
    stripWindow = addEffect('disco', 'disco2')
    stripWall.fx.layout.canvasStart = 57
    stripWall.fx.layout.fxLength = 41
    fxList[1] = stripWall
    fxList[2] = stripWindow
}

console.log('Press <ctrl>+C to exit.')


if (false) {
    // only for ZCon
    fxList[0] = addEffect('fx_rfid')
    fxList[1] = addEffect('fire')
    fxList[2] = addEffect('slave', 'Slave1')
    fxList[3] = addEffect('slave', 'Slave2')
	variables.get('Slave2').set('slaveData', '43 64 128 32 5 5 5 77 88 99 1000')
} else {
    doCfgLoad()
/*	
	fxList.length = 0
	fxList[0] = addEffect('freeze')
	fxList[1] = addEffect('rainbow')
	fxList[1].fx._segment.start = 0
	fxList[1].fx._segment.length = 25
	fxList[1].fx._segment.start2 = 0
/*
	fxList[2] = addEffect('rainbow', 'rainbow2')
	fxList[2].fx._segment.start = 25
	fxList[2].fx._segment.length = 25
	fxList[2].fx._segment.start2 = 25
	fxList[2].fx._segment.reverse = true
*/
}

startRendering()
if (config.cluster && config.cluster.type == "server") {
	cluster.initServer(io, configManager)
}
if (config.cluster && config.cluster.type == "client") {
	cluster.initClient(configManager, config.cluster)
}


