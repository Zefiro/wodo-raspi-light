const clientFactory = require('socket.io-client')
const util = require('util')
const dns = require('dns')
const winston = require('winston')


module.exports = function() {

var self = {
	ioServer: null,
	ioClient: null,
	// config data when we act as client
	client: {
		connected: false,
		logger: null,
	},
	// config data when we act as server
	server: {
		clientSocket: null,
		logger: null,
		timeoutId: 0,
	},
	
	initServer: function(ioServer, configManager) {
		self.server.logger = winston.loggers.get('cluster-server')
		self.ioServer = ioServer
		self.configManager = configManager
		self.server.logger.info("ready for clients")
		self.updateBrowser()

		self.ioServer.of('cluster').on('connection', async (s) => {
			s.on('disconnect', function(data){
				if (self.server.clientSocket == s) {
					self.server.clientSocket = null
					self.server.logger.info("client disconnected")
					self.updateBrowser()
				}
			})
			s.on('cluster-subscribe', async (data) => {
				self.server.clientSocket = s
				self.updateConfig()
				self.updateBrowser()
				let rdns = await util.promisify(dns.reverse)(s.client.conn.remoteAddress)
				self.server.logger.info("client connected from " + s.client.conn.remoteAddress + " (" + rdns + ")")
			})
		})
	},

	initClient: function(configManager, clusterConfig) {
		self.client.logger = winston.loggers.get('cluster-client')
		self.clusterConfig = clusterConfig
		self.configManager = configManager
		self.client.logger.info("trying to connect to " + self.clusterConfig.url)
		self.updateBrowser()

		self.ioClient = clientFactory(self.clusterConfig.url + '/cluster')
		self.ioClient.on('connect', self.onConnect);
		self.ioClient.on('event', self.onEvent);
		self.ioClient.on('disconnect', self.onDisconnect);
		self.ioClient.on('cluster-update', function(data) {
			self.client.logger.info("got an update")
			let fxList = self.configManager.fxList
			fxList.length = 0
			for(var i = 0; i < data.fxList.length; i++) {
				var fx = self.configManager.addEffect(data.fxList[i].name)
				var cfg = data.fxList[i].cfg
				fx.fx.loadConfigData(cfg)
				fx.fx.layout.fxStart = self.clusterConfig.offset
				fx.fx.layout.reverse = self.clusterConfig.reverse ? true : false
				fxList.push(fx)
			}
			self.configManager.update()
		});
	},
	
	updateBrowser: function() {
		if (!self.configManager) return
		let data = ""
		if (self.ioServer) {
			data += "<b>Cluster Server:</b> "
			data += (self.server.clientSocket) ? "<span title='" + self.server.clientSocket.id + "'>client connected</span>" : "waiting for clients"
			data += "<br>"
			self.server.logger.info("updated browser status")
		}
		if (self.ioClient) {
			data += "<b>Cluster Client:</b> "
			data += self.client.connected ? "connected to server" : "trying to connect"
			data += "<br>"
			self.client.logger.info("updated browser status")
		}
		self.configManager.sendToBrowser("cluster-status", data)
	},
	
	onConnect: function() {
		self.client.connected = true
		self.client.logger.info("Connected as client")
		self.ioClient.emit('cluster-subscribe')
		self.updateBrowser()
	},

	onEvent: function(data) {
		self.client.logger.info("got an event:")
		self.client.logger.info(data)
	},

	onDisconnect: function() {
		self.client.connected = false
		self.client.logger.info("got disconnected")
		self.updateBrowser()
	},
	
	// Sends the current config to the client
	updateConfig: function() {
		if (!self.ioServer) {
			return
		}
		if (self.server.clientSocket == null) {
			self.server.logger.info("no client to send update to")
			return
		}
		let fxList = self.configManager.fxList
		data = {
			fxList: []
		}
		for (var i = 0; i < fxList.length; i++) {
			var fxCfg = fxList[i].fx.saveConfigData()
			data.fxList[i] = {
				name: fxList[i].name,
				cfg: fxCfg,
			}
		}
		self.server.clientSocket.emit('cluster-update', data)
		// update from time to time, to restore sync when 'time jumped'. It does flicker, though :(
		clearTimeout(self.server.timeoutId)
		self.server.timeoutId = setTimeout(() => {
			self.server.logger.info("Pushed current state to client (regular update to stay in sync)")
			self.updateConfig()
		}, 5 * 60 * 1000)
	}
    
}
    return self
}
