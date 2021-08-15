/*
 * http://www.steves-internet-guide.com/using-node-mqtt-client/
 * https://github.com/mqttjs/async-mqtt
 *
 * Configure Tasmota with:
   Backlog mqtthost grag.fritz.box; mqttport 1883; mqttuser <username>; mqttpassword <password>; topic <device_topic>;
 */


const mqtt = require('async-mqtt')
const winston = require('winston')
const { v4: uuidv4 } = require('uuid')

 module.exports = function(config, god) { 
	var self = {
		
	logger: {},
	client: {},
	triggers: {},
	
	init: function() {
		this.logger = winston.loggers.get('mqtt')
		this.client = mqtt.connect(config.server, { clientId: config.clientId } )
		this.logger.info("Connecting to mqtt server %s as %s", config.server, config.clientId)
		this.publish = this.client.publish.bind(this.client)
		
		this.client.on("error", async (error) => {
			this.logger.error("Can't connect" + error)
			// TODO Steve says this only happens on auth failures and they are non-recoverable - other errors don't trigger this callback
		})
		this.client.on("connect", async () => {	
			// TODO apparently 'connect' is called each second?!?
			this.logger.info("Connected " + this.client.connected)
//			this.client.subscribe('#') // for debugging or finding new messages
		})
		
		this.client.on('message', this._onMessage.bind(this))
		god.terminateListeners.push(this.onTerminate.bind(this))
	},
	
	onTerminate: async function() {
		await this.client.end()
	},
	
	_onMessage: function(topic, message, packet) {
		let trigger = this.triggers[topic]
		if (!trigger) {
			// not found? try one level more generic
			let topic2 = topic.replace(/\/[^/]+$/, '/#')
			trigger = this.triggers[topic2]
		}
		if (!trigger) {
			// unrecognized mqtt message
			this.logger.debug("unrecognized: " + topic + " -> " + message.toString().substr(0, 200))
			return
		}
		let keys = Object.keys(trigger)
		for(let i=0; i < keys.length; i++) {
			let t = trigger[keys[i]]
			this.logger.info(t.id + ": " + message.toString())
			t.callback(t, topic, message, packet)
		}
	},
	
	/** adds a MQTT topic trigger
	 * topic: the MQTT topic.
	 * id: ID which will be passed to the callback (as trigger.id)
	 * callback: function(trigger, topic, message, packet)
	 * returns the trigger uuid, which can be used to remove the trigger again
	 */
	addTrigger: async function(topic, id, callback) {
		if (!this.triggers[topic]) {
			this.triggers[topic] = {}
			this.logger.info("Subscribing to %s", topic)
			await this.client.subscribe(topic)
		}
		let uuid = uuidv4()
		this.triggers[topic][uuid] = {
			uuid: uuid,
			id: id,
			callback: callback,
		}
		this.logger.debug("Adding trigger %s (%s) to subscription for %s", id, uuid, topic)
		return uuid
	},
	
	removeTrigger: async function(topic, uuid) {
		if (!this.triggers[topic]) {
			this.logger.warn("Trying to remove trigger %s, but no active subscription for topic %s", uuid, topic)
			return
		}
		if (!this.triggers[topic][uuid]) {
			this.logger.warn("Trying to remove trigger %s for %s, but trigger not found", uuid, topic)
			return
		}
		this.logger.debug("Removing trigger '%s' (%s) from subscription for %s", this.triggers[topic][uuid].id, uuid, topic)
		delete this.triggers[topic][uuid]
		if (!Object.keys(this.triggers[topic]).length) {
			this.logger.info("Unsubscribing from " + topic)
			await this.client.unsubscribe(topic)
			delete this.triggers[topic]
		}
	},
	
	publish: async(topic) => { // gets overwritten with this.client.publish(topic, message) in init()
		this.logger.error("Trying to publish to topic %s before mqtt was initialized", topic)
	},
	
}
    self.init()
    return self
}
