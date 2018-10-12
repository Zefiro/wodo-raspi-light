const util = require('./fx_util')
const dict = require("dict")
const axios = require('axios');

module.exports = function(layout, name) { return {

    // FX configuration
	_pushInterval: 20 * 1000,
	_pushErrorCount: 0,
	_maxPushErrorCount: 5,
	variables: dict({
		slaveId: 1,
		slaveIp: undefined,
		slaveType: undefined,
		slaveData: "12 64 128 32 5 5 5 77 88 99 1000 2 96 96 0 5 5 5 77 88 99 1000 2 128 0 0 5 5 5 77 88 99 1000 12 64 128 32 5 5 5 77 88 99 1000",
		lastPushed: 0,
	}),
	
    getName: function() {
        return "External Slave"
    },
    
    getConfigHtml: function(idx) {
		var metaconfig = { c: [
			{ name: 'Slave Info', type: 'dynamictext', id: 'slaveInfo', desc: '', css:'' },
			{ name: 'Data', type: 'string', id: 'slaveData', desc: 'Data (<a href="https://github.com/kitesurfer1404/WS2812FX" target="_blank">see documentation</a>)', css:'width:800px;' },
		],
		name: this.getName(),
		}
        return util.generateConfigHtml(idx, metaconfig, this.getConfigData())
    },
    
	getConfigData: function() {
		var slaveInfo = "Slave " + this.variables.get('slaveId');
		if (this.variables.get('slaveIp') && this._pushErrorCount <= this._maxPushErrorCount) {
			slaveInfo += " of type " + this.variables.get('slaveType') + " (IP: " + this.variables.get('slaveIp') + ")"
		} else {
			slaveInfo += " (offline)"
		}
		return { slaveInfo: slaveInfo , slaveData: this.variables.get('slaveData') }
	},
	
	setConfigData: function(data) {
		this.variables.set('slaveData', data.slaveData)
		this.variables.set('lastPushed', 0)
	},

	saveConfigData: function() {
		return { slaveId: this.variables.get('slaveId'), slaveType: this.variables.get('slaveType'), slaveData: this.variables.get('slaveData') }
	},
	
	loadConfigData: function(data) {
		this.variables.set('slaveData', data.slaveData)
	},
	
	_pushToSlave: function() {
		var self = this
		var lastPushed = this.variables.get('lastPushed')
		if (Date.now() - lastPushed < this._pushInterval) return
        if (this._pushErrorCount > this._maxPushErrorCount && lastPushed != 0) return
		this.variables.set('lastPushed', new Date())
		var slaveIp = this.variables.get('slaveIp')
		var slaveId = this.variables.get('slaveId')
		if (!slaveIp) { 
			this._pushErrorCount++
		    console.log("Not updating slave " + slaveId + ": no ip (" + this._pushErrorCount + ")")
		    return
		}
		var slaveData = this.variables.get('slaveData')
		axios.post('http://' + slaveIp, { 'data': ' ' + slaveData + ' ' })
            .then(function (response) {
				console.log("Updated slave " + slaveId)
				self._pushErrorCount = 0
            })
            .catch(function (error) {
				self._pushErrorCount++
				console.log("Updating slave " + slaveId + " failed (" + self._pushErrorCount + "): " + (error.response ? error.response.status + " " + error.response.statusText : error.code))
        })
	},

    renderColors: function(canvas, variables) {
		this._pushToSlave()
    	return canvas
    },
    
}}
