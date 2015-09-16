var util = require('./fx_util')
var i2c = require('i2c-bus') // modprobe i2c-dev && modprobe i2c-bcm2708 baudrate=100000
var dict = require("dict")

const I2C_BUS_NUMBER = 1
const I2C_ADDRESS = 2

module.exports = function(_numLeds, variables) { 
	self = {

    // FX configuration
    dmx_startIdx: 1,
	dmx_length: 3,
	dmx_lastUpdate: new Date(),

	variables: dict({
		dmx: []
	}),
	
// ------------------------------------------------------------------------------------------------------------------------
// Communication with external DMX receiver (Arduino based)

	dmx_lastWasZero: 0,
	i2c_ready: false,
	i2c_lastFail: false,
	i2c_dmx: null,
	lastDMX: new Date(),
	readDMX: function () {
		self = this
    	if (!this.i2c_ready) return
		if (new Date() < this.lastDMX + 100) return
		this.lastDMX = new Date();
		const DMX_ADDRESS = self.dmx_startIdx
		const DMX_BYTES_TO_READ = self.dmx_length
		var buf = new Buffer([1, DMX_ADDRESS & 0xff, DMX_ADDRESS >> 8, DMX_BYTES_TO_READ]);
		if (this.i2c_lastFail) {
			buf = new Buffer([3, 1, 2, 3]);
			this.i2c_dmx.i2cWrite(I2C_ADDRESS, buf.length, buf, function(err) {
				if (err) {
					this.i2c_lastFail = true
					console.log("i2cWrite failed again: " + err)
					return
				}
				var buf = new Buffer(DMX_BYTES_TO_READ)
				self.i2c_dmx.i2cRead(I2C_ADDRESS, DMX_BYTES_TO_READ, buf, function(err, bytesRead, buffer) {
					if (err) {
						console.log("i2cRead failed: " + err)
						return
					}
					if (bytesRead < DMX_BYTES_TO_READ) {
						console.log("read " + bytesRead + " of " + DMX_BYTES_TO_READ);
						return
					}				
					console.log("DMX retry: " + buffer[0] + " " + buffer[1] + " " + buffer[2] + "      \033[1A");
					if (buffer[0] == 1 && buffer[1] == 2 && buffer[2] == 3) {
						this.i2c_lastFail = false
					}
				})
			})
			return
		}
		this.i2c_dmx.i2cWrite(I2C_ADDRESS, buf.length, buf, function(err) {
			if (err) {
				this.i2c_lastFail = true
				console.log("i2cWrite failed: " + err)
				return
			}
			var buf = new Buffer(DMX_BYTES_TO_READ)
			self.i2c_dmx.i2cRead(I2C_ADDRESS, DMX_BYTES_TO_READ, buf, function(err, bytesRead, buffer) {
				if (err) {
					console.log("i2cRead failed: " + err)
					return
				}
				if (bytesRead < DMX_BYTES_TO_READ) {
					console.log("read " + bytesRead + " of " + DMX_BYTES_TO_READ);
					return
				}
				// the DMX receiver currently has an issue that it sometimes (quite often) reads all-zero instead of the correct value :(
				allZero = true
				for(i=0; i<bytesRead; i++) {
					if (buffer[i] != 0) allZero = false
				}
				if (allZero) {
					if (self.dmx_lastWasZero < 5) {
						self.dmx_lastWasZero++
						console.log("DMX zero - ignored (" + self.dmx_lastWasZero + ")")
						return
					} else {
						console.log("DMX zero - accepted")
					}
				} else {
					self.dmx_lastWasZero = 0
				}
				
				extdmx = self.variables.get('dmx')
				for(i=0; i<bytesRead; i++) {
					extdmx[i] = buffer[i]
				}
				console.log("DMX: " + buffer[0] + " " + buffer[1] + " " + buffer[2] + "      \033[1A");
			})
		})
	},

// ------------------------------------------------------------------------------------------------------------------------

	init: function() {
		self = this
		this.i2c_dmx = i2c.open(I2C_BUS_NUMBER, function (err) {
		  if (err) throw err
		  self.i2c_ready = true
		})
	},
    
    getInputIndexes: function() {
        return []
    },
    
    getName: function() {
        return "DMX Receiver"
    },
	
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Start Index', type: 'int', id: 'dmx_startIdx', desc: 'DMX Start Index (begins with 1)', css:'width:50px;' },
			{ name: 'DMX Length', type: 'int', id: 'dmx_length', desc: 'number of DMX values to receive', css:'width:50px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
	
	getConfigData: function() {
        return {
	        dmx_startIdx: this.dmx_startIdx,
            dmx_length: this.dmx_length,
            dmx_lastUpdate: this.dmx_lastUpdate,
        }
	},
	
	setConfigData: function(data) {
		console.log("DMX.setConfigData:")
		console.log(data)
        this.dmx_startIdx = data.dmx_startIdx
        if (this.dmx_length != data.dmx_length) {
          this.dmx_length = data.dmx_length
          this.variables.set('dmx', [])
        }
	},
    
	saveConfigData: function() {
        return {
	        dmx_startIdx: this.dmx_startIdx,
            dmx_length: this.dmx_length,
        }
	},
	
	loadConfigData: function(data) {
        this.dmx_startIdx = data.dmx_startIdx
        this.dmx_length = data.dmx_length
	},
    
    renderColors: function(inputColors, variables) {
		// trigger a next read, which will happen asynchronously, unfortunately
	    this.readDMX()
    	return inputColors
    },
    
}
    self.init()
    return self
}
