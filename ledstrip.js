#!/usr//bin/node

var ws281x = require('node-rpi-ws281x-native')
var app = require('express')()
var fs = require('fs')
var Q = require('q')
var http = require('http').Server(app)
var io = require('socket.io')(http)
var util = require('./fx/fx_util')

var NUM_LEDS = parseInt(process.argv[2], 10) || 50
var colors = new Array(NUM_LEDS)
var pixelData = new Uint32Array(NUM_LEDS)
var fxList = []


logDActivated = false


ws281x.init(NUM_LEDS, { "invert": 1, "frequency": 400000 } )

// ---- trap the SIGINT and reset before exit
process.on('SIGINT', function () {
    console.log("Bye, Bye...")
    ws281x.reset()
    process.nextTick(function () { process.exit(0) })
})

app.use(require('express').static(__dirname + '/public'))

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

io.on('connection', function(socket){
  var clientId = getNewClientId()
  console.log('a user connected from ' + socket.client.conn.remoteAddress + ", clientId=" + clientId)

  socket.on('fxClientId', function(data){
    socket.emit('fxClientId', clientId)
  })
  
  socket.on('fxConfigRead', function(data){
    sendFullConfig()
  })
  
  socket.on('fxConfigWrite', function(data){
    dataOut = []
    for(var idx = 0; idx < data.length; idx++) {
        console.log(data[idx])
		var fxIdx = data[idx].fx
		var cfg = data[idx].cfg
		var fx = fxList[fxIdx].fx
		// TODO compare ID if it's still an active effect, silently ignore otherwise
		fx.setConfigData(cfg)
		dataOut.push({fx:fxIdx,id:0,clientId:clientId,cfg:cfg})
    }
    io.emit('fxConfigWrite', dataOut)
	
	console.log("Emited:"); console.log(dataOut)
  })

  socket.on('setFx', function(data) {
    console.log("setFx("+data+")")
    fxList[1] = addEffect(fxNames[data])
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
    console.log('user disconnected')
  })

  socket.on('cfgDoSave', function(msg){
    doCfgSave(socket, msg)
  })
  socket.on('cfgDoLoad', function(msg){
    doCfgLoad(socket, msg)
  })
})

http.listen(80, function(){
  console.log('listening on *:80')
})


var fxNames = ['combine', 'rainbow', 'singleColor', 'fire', 'transpose']

function addEffect(fxName) {
    console.log("adding effect " + fxName + "(" + NUM_LEDS + ")")
    return {
        name: fxName,
        fx: require('./fx/' + fxName)(NUM_LEDS),
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
        socket.emit("toast", "Failed to read config")
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
        socket.emit("toast", "Config loaded")
    })
}

// used by renderColors() and renderColorsRecursive()
var tempColors = []

// ensures that tempColors[idx] is defined, by calling renderColors of fxList[idx].fx if it exists (otherwise default to black)
function renderColorsRecursive(idx) {
    logD("Entering renderColorsRecursive("+idx+")")
    if (fxList[idx] === undefined) {
        logD("renderColorsRecursive: undefined fx[" + idx + "], default to black")
        tempColors[idx] = util.mergeColors(NUM_LEDS)
        return
    }
    var inputIdxList = fxList[idx].fx.getInputIndexes()    
    var inputColors = []
    for(var i = 0; i < inputIdxList.length; i++ ) {
        var inputIdx = inputIdxList[i]
        if (inputIdx == idx) {
            logD("renderColorsRecursive: input #" + i + " is fx #" + inputIdx + " -> it's us! use black")
            tempColors[inputIdx] = allBlack(NUM_LEDS)
        } else if (tempColors[inputIdx] === undefined) {
            logD("renderColorsRecursive: input #" + i + " is fx #" + inputIdx + " -> not defined yet, recursion")
            renderColorsRecursive(inputIdx)
        }
        inputColors[i] = tempColors[inputIdx]
        logD("inputColors now defined:")
//        console.log(inputColors)
    }
    logD("renderColorsRecursive: calling fx[" + idx + "] '"+fxList[idx].fx.getName()+"' with inputs: " + inputIdxList)
    tempColors[idx] = fxList[idx].fx.renderColors(inputColors)
//    console.log(tempColors)
}

function renderColors() {
    tempColors = []
    renderColorsRecursive(0)
    return util.mergeColors(NUM_LEDS, tempColors[0])
}

var timerId = setInterval(function () {
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
}, 1000 / 30)



console.log('Press <ctrl>+C to exit.')

doCfgLoad()
