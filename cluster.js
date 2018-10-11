const clientFactory = require('socket.io-client')



module.exports = function() {

var self = {
	ioServer: null,
	ioClient: null,
	url: null,
	// config data when we act as client
	client: {
		connected: false
	},
	// config data when we act as server
	server: {
		clientSocket: null,
	},
	
	initServer: function(ioServer, configManager, url) {
		self.ioServer = ioServer
		self.configManager = configManager
		console.log("ClusterD: ready for clients")

		self.ioServer.on('connection', function(s) {
			s.on('disconnect', function(data){
				if (self.server.clientSocket == s) {
					self.server.clientSocket = null
					console.log("ClusterD: client disconnected")
				}
			})
			s.on('cluster-subscribe', function(data){
				self.server.clientSocket = s
				console.log("ClusterD: client connected")
				self.updateConfig();
			})
		})
	},

	initClient: function(ioServer, configManager, clusterConfig) {
		self.clusterConfig = clusterConfig
		self.configManager = configManager
		console.log("ClusterC: trying to connect to " + clusterConfig.url)

		self.ioClient = clientFactory(url)
		self.ioClient.on('connect', self.onConnect);
		self.ioClient.on('event', self.onEvent);
		self.ioClient.on('disconnect', self.onDisconnect);
		self.ioClient.on('cluster-update', function(data) {
			console.log("ClusterC: got an update")
			let fxList = self.configManager.fxList
			fxList.length = 0
			for(var i = 0; i < data.fxList.length; i++) {
				var fx = self.configManager.addEffect(data.fxList[i].name).requireIdx([i+1])
				var cfg = data.fxList[i].cfg
				fx.fx.loadConfigData(cfg)
				fx.fx._segment.start = self.clusterConfig.offset
				fx.fx._segment.reverse = self.clusterConfig.reverse ? true : false
				fxList.push(fx)
			}
			self.configManager.update()
		});
	},
	
	onConnect: function() {
		self.client.connected = true
		console.log("Cluster: Connected as client")
		self.ioClient.emit('cluster-subscribe', '')
	},

	onEvent: function(data) {
		console.log("Cluster: got an event:")
		console.log(data)
	},

	onDisconnect: function() {
		self.client.connected = false
		console.log("Cluster: got disconnected")
	},
	
	// Sends the current config to the client
	updateConfig: function() {
		if (!self.server || self.server.clientSocket == null) return
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
	}
    
}
    return self
}
