#!/usr/local/bin/node

var ws281x = require('../lib/ws281x-native')
var app = require('express')()
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

//app.get('/', function(req, res){
//  res.sendFile(__dirname + '/public/index.html')
//})

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function rgb2html(color) {
    return rgbToHex(color.r, color.g, color.b);
}

function sendFullConfig() {
	console.log("Resending config to all clients")
    html = "<h3>Configuration</h3>"
    for(var idx = 0; idx < fxList.length; idx++) {
        html += util.fxgroup(idx, fxList[idx])
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
		var fx = fxList[fxIdx]
		// TODO compare ID if it's still an active effect, silently ignore otherwise
		fx.setConfigData(cfg)
		dataOut.push({fx:fxIdx,id:0,clientId:clientId,cfg:cfg})
    }
    io.emit('fxConfigWrite', dataOut)
	
	console.log("Emited:"); console.log(dataOut)
  })

  socket.on('setFx', function(data) {
    console.log("setFx("+data+")")
	fxList[1] = require('./fx/' + fxNames[data])(NUM_LEDS,fxNames[data])
    sendFullConfig()
  })

  socket.on('fxColorRead', function(msg){
    data = { c: [] }
    for(var idx = 0; idx < colors.length; idx++) {
        data.c[idx] = rgb2html(colors[idx])
    }
    socket.emit('fxColorRead', data)
  })

  socket.on('disconnect', function(){
    console.log('user disconnected')
  })
})

http.listen(80, function(){
  console.log('listening on *:80')
})

function rgb2Int(r, b, g) {
  if (g == 255) { g = 254 }
  return ((r & 0xff) << 16) + ((g & 0xff) << 8) + (b & 0xff)
}


var fxNames = ['combine', 'rainbow', 'singleColor', 'fire', 'transpose']

fxList[0] = require('./fx/freeze')(NUM_LEDS,'freeze')
fxList[1] = require('./fx/' + fxNames[2])(NUM_LEDS,fxNames[2])

//fxList[0] = require('./fx/shippo')(NUM_LEDS)

function logD(obj) {
    if (logDActivated) {
        console.log(obj)
    }
}

// used by renderColors() and renderColorsRecursive()
var tempColors = []

function allBlack(numLeds) {
    colors = []
    for(var i = 0; i < numLeds; i++) {
        colors[i] = { r: 0, g: 0, b: 0 }
    }
    return colors
}

// ensures that tempColors[idx] is defined, by calling renderColors of fxList[idx] if it exists (otherwise default to black)
function renderColorsRecursive(idx) {
    logD("Entering renderColorsRecursive("+idx+")")
    if (fxList[idx] === undefined) {
        logD("renderColorsRecursive: undefined fx[" + idx + "], default to black")
        tempColors[idx] = allBlack(NUM_LEDS)
        return
    }
    var inputIdxList = fxList[idx].getInputIndexes()    
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
    logD("renderColorsRecursive: calling fx[" + idx + "] '"+fxList[idx].getName()+"' with inputs: " + inputIdxList)
    tempColors[idx] = fxList[idx].renderColors(inputColors)
//    console.log(tempColors)
}

function renderColors() {
    tempColors = []
    renderColorsRecursive(0)
    return tempColors[0]
}

var timerId = setInterval(function () {
    logD("Timer: render all colors")
//    fxList[0].transparency = (fxList[0].transparency + 10) % 100
    colors = renderColors()
    // set the colors
	if (colors === undefined || colors.length != NUM_LEDS) {
		console.log("colors is empty! Aborting!")
		process.exit(1)
	}
    for(var i=0; i<NUM_LEDS; i++) { 
		pixelData[i] = rgb2Int(colors[i].r, colors[i].g, colors[i].b)
	}
	ws281x.render(pixelData)
}, 1000 / 30)

console.log('Press <ctrl>+C to exit.')
