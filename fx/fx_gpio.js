const util = require('./fx_util')
const Gpio = require('onoff').Gpio;
const winston = require('winston')

var currentSelf = null
async function triggerProxy(trigger, topic, message, packet) {
    if (currentSelf) return await currentSelf.onMqttMessagePower(trigger, topic, message, packet)
}

module.exports = function(layout, name, god) { 
    if (currentSelf) {
        currentSelf.logger.warn('FX already loaded - returning cached singleton')
        return currentSelf
    }
var self = {

    // FX configuration
	gpio: undefined,
	gpio_on: true,
	logger: winston.loggers.get('fx_gpio'),
	initialized: false,
    
    getName: function() {
        return "Controls the power to the LED Strip"
    },
	
	init: function() {
		if (this.initialized) return
		this.gpio = new Gpio(17, 'out')
		god.terminateListeners.push(this.onTerminate.bind(this))
		this.gpio.writeSync(this.gpio_on ? 1 : 0)
		if (god.mqtt) {
            god.mqtt.addTrigger('cmnd/' + god.config.mqtt.clientId + '/POWER', 'Power', triggerProxy)
		}
		this.initialized = true
	},
    
    onMqttMessagePower: async function(trigger, topic, message, packet) {
        this.logger.info("Got mqtt cmnd: Power %s", message)
        if (message == 'ON') {
            this.logger.debug('Setting gpio_on: true')
            this.setConfigData({ gpio_on: true })
        } else if (message == 'OFF') {
            this.logger.debug('Setting gpio_on: false')
            this.setConfigData({ gpio_on: false })
        } else if (message == 'TOGGLE') {
            let newValue = !this.gpio_on
            this.logger.debug('Toggling gpio_on to: ' + (newValue ? 'ON' : 'OFF'))
            this.setConfigData({ gpio_on: newValue })
        } else if (message == '') {
            let topic2 = 'stat/' + god.config.mqtt.clientId + '/POWER'
            let value = this.gpio_on ? 'ON' : 'OFF'
            this.logger.debug('Answering %s %s', topic2, value)
            god.mqtt.publish(topic2, value)
        } else {
            this.logger.info('Power value %s unknown', message)
            god.mqtt.publish('stat/' + god.config.mqtt.clientId + '/RESULT', 'Unknown' )
        }
    },
    
	onTerminate: async function() {
		try {
			this.logger.info("GPIO: Switching off LEDs and unexporting GPIO pin %o", this.gpio._gpio)
			this.gpio.writeSync(0)
			this.gpio.unexport()
		} catch (e) {
			if (e && (e.toString().startsWith('Error: EBADF: bad file descriptor') || e.toString().startsWith('Error: ENODEV: no such device'))) {
				// simplify error message
				this.logger.error("Exception during freeing of GPIO pin: --- %s", e.toString())
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
    currentSelf = self
	return self
}
