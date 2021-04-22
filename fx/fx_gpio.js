const util = require('./fx_util')
const Gpio = require('onoff').Gpio;
const winston = require('winston')

module.exports = function(layout, name, god) { 
var self = {

    // FX configuration
	gpio: undefined,
	gpio_on: true,
	logger: winston.loggers.get('fx_gpio'),
    
    getName: function() {
        return "Switches the strip off"
    },
	
	init: function() {
		this.gpio = new Gpio(17, 'out')
		god.terminateListeners.push(this.onTerminate.bind(this))
		this.gpio.writeSync(this.gpio_on ? 1 : 0)
		if (god.mqtt) {
			god.mqtt.addTrigger('cmnd/' + god.config.mqtt.clientId + '/POWER', 'Power', async (trigger, topic, message, packet) => {
				this.logger.info("Got mqtt cmnd: Power %s", message)
				if (message == 'ON') {
					this.setConfigData({ gpio_on: true })
				} else if (message == 'OFF') {
					this.setConfigData({ gpio_on: false })
				} else if (message == '') {
					god.mqtt.publish('stat/' + god.config.mqtt.clientId + '/POWER', this.gpio_on ? 'ON' : 'OFF' )
				} else {
					god.mqtt.publish('stat/' + god.config.mqtt.clientId + '/RESULT', 'Unknown' )
				}
			})
		}
	},
    
	onTerminate: async function() {
		try {
			this.logger.info("GPIO: Switching off LEDs and unexporting GPIO pin")
			this.gpio.writeSync(0)
			this.gpio.unexport()
		} catch (e) {
			console.log(e)
			if (e.startsWith('Error: EBADF: bad file descriptor')) {
				// simplify error message
				this.logger.error("Exception during freeing of GPIO pin: --- %s", e)
			} else {
			this.logger.error("Exception during freeing of GPIO pin: %o", e)
			}
		}
	},

    getConfigHtml: function(idx) {
		var prefix = "fx" + idx + "_"
		let btnText1 = "Switch LEDs on" // false => true
		let btnText2 = "Switch LEDs off" // true => false
		html = `
<button onclick='${prefix}sendUpdateButton(!${prefix}toggleButtonValue);return false' id='${prefix}btn_gpio_on'>...</button><br>
<script>
var ${prefix}toggleButtonValue=false
function ${prefix}sendUpdateButton(value){
${prefix}updateButton(value)
socket.emit('browser-sendConfigUpdate', [{fx:${idx},id:0,cfg:{gpio_on: ${prefix}toggleButtonValue}}]);
}
function ${prefix}updateButton(value){
${prefix}toggleButtonValue=value;
if(${prefix}toggleButtonValue){$('#${prefix}btn_gpio_on').text('${btnText2}')}
else{$('#${prefix}btn_gpio_on').text('${btnText1}')}
}
fxConfigUpdaters[${idx}]=function(cfg){
console.log('browserD-sendConfigUpdate->gpio got cfg:', cfg);
${prefix}updateButton(cfg.gpio_on)
}
${prefix}updateButton(${this.gpio_on})
</script>
`
        return html
    },
	
	getConfigData: function() {
		return { gpio_on: this.gpio_on }
	},
	
	setConfigData: function(data) {
		this.gpio_on = data.gpio_on
		this.gpio.writeSync(data.gpio_on ? 1 : 0)
		if (god.mqtt) { god.mqtt.publish('stat/' + god.config.mqtt.clientId + '/POWER', this.gpio_on ? 'ON' : 'OFF' ) }
	},
    
	loadConfigData: function(data) {
		this.gpio_on = data.gpio_on
		this.gpio.writeSync(data.gpio_on ? 1 : 0)
		if (god.mqtt) { god.mqtt.publish('stat/' + god.config.mqtt.clientId + '/POWER', this.gpio_on ? 'ON' : 'OFF' ) }
	},
	
	saveConfigData: function() {
	    var cfg = { gpio_on: this.gpio_on }
		return cfg
	},
    
    renderColors: function(canvas) {
		return canvas
    },
    
}
	self.init()
	return self
}
