#!/usr//bin/node

const app = require('express')()
const fs = require('fs')
const Q = require('q')
const http = require('http').Server(app)
const io = require('socket.io')(http, { })
const util = require('util')
const dict = require("dict")
const dns = require('dns')
const winston = require('winston')
const lo = require('lodash')

// this is our own fork, remember to set the symlink in node_modules (needs to be done after every 'npm install')
// pushd node_modules && ln -s ../../node-rpi-ws281x-native/ . && popd
const ws281x = require('node-rpi-ws281x-native')

const fxutil = require('./fx/fx_util')
const cluster = require('./cluster')()

const TARGET_FPS = 50

const fxList = []
var colors = new Array()

/* TODO
 - clusterC: show that we're a client and disable all input controls (or send them to the master?)
 - clusterD: when we got a client, change canvas size automatically? and back? with a delay?
 - Freeze auf Cluster-Client "springt"

*/

var god = {
	terminateListeners: [],
	terminate: terminate,
}

const sites = [
	{
		name: '[default]', // referenced by index 0, not by name
		displayName: '(default name)',
		ledCount: 50,
		canvasSize: 50,
		hardware: {
			dma: 10,
			gpio: 18,
			invert: 1,
			freq: 400000,
			stripType: 0x00001008, // BRG
//			strip_type: 0x00001008, // BRG
		},
		defaultfx: 'freeze',
	}, {
		name: 'regalbrett',
		displayName: 'World Domination - Regalbrett',
		cluster: {
			type: 'server',
		},
		ledCount: 96,
		canvasSize: 136,
		mqtt: {
			"server": "mqtt://cave.zefiro.de",
			"clientId": "regalbrett",
		},
	}, {
		name: 'regalbrett2',
		displayName: 'World Domination - Regalbrett2',
		cluster: {
			type: 'client',
			url: 'http://regalbrett.dhcp.cave.zefiro.de',
			offset: 96,
			reverse: true,
		},
		ledCount: 40,
		canvasSize: 136,
	}, {
		name: 'zcon',
		displayName: 'Shiny things on ZCon',
	}, {
		name: 'mendra',
		displayName: 'Burg Drachenstein',
		ledCount: 106,
		canvasSize: 106,
		defaultfx: 'fx_gpio',
		mqtt: {
			"server": "mqtt://10.20.30.40",
			"clientId": "grag-main-strip",
		},
	}, {
		name: 'shadow-stein',
		displayName: 'Wolfshöhle - Stein',
		hardware: {
			invert: 0,
			frequency: 400000,
		},
	}
]

// available effects for the user to select
// Unfinished Effects: dmx, transpose, shippo, misan
const fxNames = ['disco', 'rainbow', 'ainbow', 'singleColor', 'fire', 'shadowolf', 'alarm', 'bars']



function addNamedLogger(name, level = 'debug', label = name) {
    let { format } = require('logform');
	let getFormat = (label, colorize = false) => {
		let nop = format((info, opts) => { return info })
		return format.combine(
			colorize ? format.colorize() : nop(),
			format.timestamp({
				format: 'YYYY-MM-DD HH:mm:ss',
			}),
			format.label({ label: label }),
			format.splat(),
			format.printf(info => `${info.timestamp} [${info.level}] [${info.label}] \t${info.message}`)
			)
	}
	winston.loggers.add(name, {
	  level: level,
	  transports: [
		new winston.transports.Console({
			format: getFormat(label, true),
		}),
		new winston.transports.File({ 
			format: getFormat(label, false),
			filename: 'ledstrip.log'
		})
	  ]
	})
}
addNamedLogger('main', 'debug')
addNamedLogger('cluster-server', 'debug', 'ClusterD')
addNamedLogger('cluster-client', 'debug', 'ClusterC')
addNamedLogger('fx_freeze', 'debug', 'FX Freeze')
addNamedLogger('fx_gpio', 'debug', 'FX GPIO')
addNamedLogger('mqtt', 'debug')

const logger = winston.loggers.get('main')


const config = function() {
	for(let i = 0; i < sites.length; i++) {
		if (sites[i].name == process.argv[2]) {
			var site = sites[i]
			break
		}
	}
	if (!site) {
		logger.warn("Missing or unknown site '" + process.argv[2] + "', please choose one of:")
		sites.forEach(site => logger.warn(site.name))
		terminate(1)
	}
	site = lo.merge(sites[0], site)
	if (site.canvasSize < site.ledCount) {
		logger.warn('Canvassize ' + site.canvasSize + ' smaller than ledCount ' + site.ledCount + ', increasing it')
		site.canvasSize = site.ledCount
	}
	return site
}()
god.config = config

if (config.mqtt) {
	god.mqtt = require('./mqtt')(config.mqtt, god)
	god.mqtt.addTrigger('cmnd/' + config.mqtt.clientId + '/SCENARIO', 'Scenario', async (trigger, topic, message, packet) => {
		let res = await setScenario(message)
		god.mqtt.publish('stat/' + config.mqtt.clientId + '/RESULT', '{"SCENARIO":"' + res + '"}')
	})
}

// global 'variables' dictionary, each module will have their own (published) variables placed into it
const variables = dict()

logDActivated = false

const ledstripChannel = ws281x(config.ledCount, config.hardware )

// TODO wait for logger to finish
async function terminate(errlevel) {
	await Promise.all(god.terminateListeners.map(async listener => { 
		try { 
			await listener() 
		} catch (e) {
			if (this.logger) { this.logger.error("Exception during terminate callback: %o", e) } else { console.log("Exception during terminate callback: ", e) }
		}
	}))
    ws281x.reset()
    ws281x.finalize()
    process.nextTick(function () { process.exit(errlevel) })
}


// ---- trap the SIGINT and reset before exit
process.on('SIGINT', async function () {
    await logger.error("Program terminated - Bye, Bye...")
    terminate(0)
})

// handle the error safely
process.on('uncaughtException', async function (err) {
    await logger.error(err.stack)
    terminate(0)
})

app.use('/', require('express').static(__dirname + '/public'))


const exec = util.promisify(require('child_process').exec);
async function runCommand(cmd) {
	logger.warn("Calling system command: %s", cmd)
	const { stdout, stderr } = await exec(cmd);
	console.log('stdout:', stdout);
	console.log('stderr:', stderr);
  return stdout + "\n" + stderr
}

app.get('/cmd/:sId', async function(req, res) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	var sId = req.params.sId
	let rdns = await util.promisify(dns.reverse)(ip).catch(err => { logger.warn("Can't resolve DNS for " + ip + ": " + err); return ip + ".in.addr.arpa"; })
	logger.info("Command %s requested by %s (%s)", sId, ip, rdns)
	if (sId == "setTime") {
		configManager.visualToast()
		let stdout = await runCommand('./setTime.sh')
		res.send(stdout)
	} else if (sId == "shutdown") {
		if (req.query.pwd == 'pi') { // low-value password, reachable only from my Intranet
			configManager.visualToast()
			let stdout = await runCommand('./shutdown.sh')
			res.send(stdout)
		} else {
			res.send("Nice try. Blocked.")
		}
	} else {
     	logger.error("Command not found: " + sId)
		res.status(404).send('Command not found: ' + sId)
	}
	sendFullConfig()
});

app.get('/scenario/:sId', async function(req, res) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	var sId = req.params.sId
	let rdns = await util.promisify(dns.reverse)(ip).catch(err => { logger.warn("Can't resolve DNS for " + ip + ": " + err); return ip + ".in.addr.arpa"; })
	logger.info("Scenario %s requested by %s (%s)", sId, ip, rdns)
	let [status, result] = await setScenario(sId)
	if (status) { res.status(status) }
	res.send(result)
})

async function setScenario(sId) {
	let status, result
	if (sId == "alarm") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
        fxList[1] = addEffect('alarm')
		result = 'Alarm triggered'
	} else if (sId == "alarm2") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
        fxList[1] = addEffect('alarm')
        fxList[1].fx._duration = 200
        fxList[1].fx._speed = 1
		result = 'Alarm2 triggered'
	} else if (sId == "calm") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
        fxList[1] = addEffect('rainbow')
		fxList[1].fx.loadConfigData({
			"speed": 6000,
			"cyclelen": 1000,
			"anim": {
				"deltaT": 9139429
			}
		})
		res.send('Calming down...')
	} else if (sId == "disco") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
		fullDisco()
		result = 'Let\'s rock!'
	} else if (sId == "green_fire") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
        fxList[1] = addEffect('fire')
        fxList[1].fx.setConfigData({ color: 'green', type: 'fire' })
		result = 'Green Fire triggered'
	} else if (sId == "blue_fire") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
        fxList[1] = addEffect('fire')
        fxList[1].fx.setConfigData({ color: 'blue', type: 'fire' })
		result = 'Blue Fire triggered'
	} else if (sId == "red_fire") {
		fxList.length = 0
        fxList[0] = addEffect(config.defaultfx)
        fxList[1] = addEffect('fire')
        fxList[1].fx.setConfigData({ color: 'red', type: 'fire' })
		result = 'Red Fire triggered'
	} else if (sId == "load") {
		await doCfgLoad()
		result = 'Stored Scenario loaded'
    } else if (sId == "reset") { // Loads default scenario, but for Burg Drachenstein: switches LEDs off
        await doCfgLoad()
        // both lines should work and do the same
        if (config.name == 'mendra') fxList[0].fx.setConfigData({ gpio_on: false })
        if (config.mqtt) god.mqtt.publish('cmnd/' + god.config.mqtt.clientId + '/POWER', 'OFF')
		result = 'Stored Scenario loaded'
    } else {
        logger.error("Scenario not found: " + sId)
        status = 404
        result = 'Scenario not found: ' + sId
	}
	sendFullConfig()
	if (god.mqtt) { god.mqtt.publish('stat/' + config.mqtt.clientId + '/SCENARIO', sId) }
	return [status, result]
}

app.get('/slave/:slaveId/:type', async function(req, res) {
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
	var slaveId = req.params.slaveId
	var slaveType = req.params.type
	let rdns = await util.promisify(dns.reverse)(ip).catch(err => { logger.warn("Can't resolve DNS for " + ip + ": " + err); return ip + ".in.addr.arpa"; })
	logger.debug("Slave #%s (%s / %s) pinged (type: %s)", slaveId, ip, rdns, slaveType)

	var slaveDict = variables.get('Slave' + slaveId)
	if (slaveDict) {
		slaveDict.set('slaveIp', ip)
		slaveDict.set('slaveId', slaveId)
		slaveDict.set('slaveType', slaveType)
		slaveDict.set('lastPing', Date.now())
		slaveDict.set('lastPushed', 0)
		res.send("ok")
		sendFullConfig()
	} else {
		res.send("Unknown slave")
	}
});

http.listen(80, function(){
  logger.info('listening on *:80')
})

function sendFullConfig() {
	logger.debug("Resending full config to all clients")
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

io.of('/browser').on('connection', async (socket) => {
	// TODO this 'await' leads to loosing the first messages sent :(
	// this variant avoids this, but messes with the ordering of the logs
  (async () => {
	  let ip = socket.client.conn.remoteAddress
	  let rdns = await util.promisify(dns.reverse)(ip).catch(err => { logger.warn("Can't resolve DNS for " + ip + ": " + err); return ip + ".in.addr.arpa"; })
	  logger.info('a user connected from %s (%s)", socket.id=%s', ip, rdns, socket.id)
  })()

  socket.on('browser-subscribe', () => {
	logger.info("Identified as browser: socket.id=" + socket.id)
    socket.emit('browserD-clientId', { id: socket.id, config: { displayName: config.displayName } })
  })
  
  
  socket.on('browser-requestReadConfig', (data) => {
	logger.debug("Sending full config to %s", socket.id)
	let html = getFullConfigAsHtml()
    socket.emit('browserD-sendConfig', html)
	cluster.updateBrowser()
  })
  
  socket.on('getUserlist', (data) => {
console.log("socket received: getUserlist", data)
	  configManager.sendUserlistToBrowser(socket, data)
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
	logger.debug("Got a config update from client.id=%s, sending out to all other clients:", socket.id)
	logger.debug("%o", dataOut)
	socket.broadcast.emit('browserD-sendConfigUpdate', dataOut)
	cluster.updateConfig()
  })

  socket.on('browser-setFx', function(data) {
    logger.info("browser-setFx("+data+")")
    if (config.name == "regalbrett" && fxNames[data] === "disco") {
        fullDisco();
    } else {
		fxList.length = 1 // safest way to keep the same object, but get rid of additional effects
		if (config.name == "zcon") {
			// keep fxList[0] unchanged, as it holds state
			fxList[1] = addEffect(fxNames[data])
			fxList[2] = addEffect('slave', 'Slave1')
		} else {
			fxList[0] = addEffect(config.defaultfx)
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
    logger.warn('user disconnected, client.id=' + socket.id)
	logger.warn(data)
  })

  socket.on('browser-cfgDoSave', function(msg){
    doCfgSave(socket, msg)
  })

  socket.on('browser-cfgDoLoad', async function(msg){
    await doCfgLoad(socket, msg)
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
		configManager.sendUserlistToBrowser(io.of('/browser'), {})
	},
	sendToBrowser: function(id, data) {
	    io.of('/browser').emit(id, data)
	},
	variables: variables,
	fxList: fxList,
	addEffect: addEffect,
	toast: function(txt) {
		if (io) {
			logger.info("Toasting: " + txt)
			io.emit("toast", txt)
		}
	},
	sendUserlistToBrowser: function() {},
	visualToast: function() {
		if (this['active']) {
			logger.warn("Visualtoast: already active, skipped")
			return
		}
		logger.info("Visualtoast: triggered")
		this.active = true
        this.effect = addEffect('alarm')
		configManager.fxList.unshift(this.effect)
		setTimeout(() => {
			if (configManager.fxList[0] === this.effect) {
				logger.info("Visualtoast: finished")
				configManager.fxList.shift()
				configManager.update()
			} else {
				logger.warn("Visualtoast: finished, but toast effect had already been removed")
			}
			this.active = false
		}, 1000)
		configManager.update()
	},
}

function addEffect(fxName, fxVarName) {
    if (!fxVarName) fxVarName = fxName
    logger.debug("adding effect " + fxName + " as " + fxVarName + " (" + config.canvasSize + ")")
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
	effect = require('./fx/' + fxName)(layout, configManager, god)
	variables.set(fxVarName, effect.variables)
    return {
        name: fxName,
		varName: fxVarName,
        fx: effect,
    }
}

function logD(obj) {
    if (logDActivated) {
        logger.info(obj)
    }
}

var cfgFilename = "ledstrip.conf"
async function doCfgSave(socket, msg) {
    logger.info("Save triggered...")
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
        logger.error("Failed to write config file " + cfgFilename + ": " + error)
        socket.emit("toast", "Failed to write config")
	}
}

async function doCfgLoad(socket, msg) {    
    logger.info("Load triggered...")
	let readFile = util.promisify(fs.readFile)
	try {
		let data = await readFile(cfgFilename, {encoding: 'utf-8'})
        var config = JSON.parse(data)
	} catch (error) {
        logger.error("Failed to read config file " + cfgFilename + ": " + error)
        socket && socket.emit("toast", "Failed to read config")
		return
    }
	try {
        fxList.length = 0
        for(var i = 0; i < config.fxList.length; i++) {
            var fx = addEffect(config.fxList[i].name)
            var cfg = config.fxList[i].cfg
            fx.fx.loadConfigData(cfg)
            fxList.push(fx)
        }
		logger.info("Config loaded: " + fxList.length + " effects")
        sendFullConfig()
        socket && socket.emit("toast", "Config loaded")
	} catch (error) {
        logger.error("Failed to parse config file " + cfgFilename + ": " + error)
        socket && socket.emit("toast", "Failed to parse config")
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
    var timerId = setInterval(async function () {
        fps_currentDate = new Date()
        timediff = fps_currentDate - fps_lastDate
        fps_lastDate = fps_currentDate
        fps_smoothed = (fps_smoothed * 31 + timediff) / 32
        
        logD("Timer: render all colors")
        colors = await renderColors()
        // set the colors
        if (colors === undefined || colors.length != config.canvasSize) {
            logger.error("colors is undefined or of wrong length! Aborting!")
            terminate(1)
        }
        for(let i = 0; i < config.ledCount; i++) { 
            let c = fxutil.rgb2Int(colors[i].r, colors[i].g, colors[i].b)
            pixelData[i] = c
            ledstripChannel.array[i] = c
        }
        ws281x.render(pixelData)
        
    //    logger.info("\033[1A" + Math.round(1000 / fps_smoothed) + " / " + (new Date() - fps_currentDate) + " ")
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

logger.info('Press <ctrl>+C to exit.')


if (config.name == 'zcon') {
    // only for ZCon
    fxList[0] = addEffect('fx_rfid')
    fxList[1] = addEffect('fire')
    fxList[2] = addEffect('slave', 'Slave1')
    fxList[3] = addEffect('slave', 'Slave2')
	variables.get('Slave2').set('slaveData', '43 64 128 32 5 5 5 77 88 99 1000')
} else if (process.argv[3]) {
	scenario = process.argv[3]
    process.nextTick(async function () {
		logger.info("Scenario given on commandline: " + scenario)
		let result = await setScenario(scenario)
		logger.info("Scenario %s result: %s", scenario, result)
	})
} else {
    (async () => {
        await setScenario('reset')
    })()
}

startRendering()
if (config.cluster && config.cluster.type == "server") {
	cluster.initServer(io, configManager)
}
if (config.cluster && config.cluster.type == "client") {
	cluster.initClient(configManager, config.cluster)
}

