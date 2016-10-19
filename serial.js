#!/usr//bin/node

var serialport = require('serialport');
var SerialPort = serialport.SerialPort;

serialport.list(function (err, ports) {
  console.log("Serial ports found:");
    ports.forEach(function(port) {
      console.log(port.comName);
      console.log(port.pnpId);
      console.log(port.manufacturer);
    });
});

var comPortName = '/dev/ttyUSB0';
var serial = new SerialPort(comPortName, {
    baudrate: 9600,
	parser: serialport.parsers.readline('\n')
}, false);

serial.open(function (error) {
  if ( error ) {
    console.log('failed to open: '+error);
  } else {
    console.log('open');
    serial.on('data', function(data) {
      console.log('data received: ' + data);
    });
    serial.write("dragon", function(err, results) {
      console.log('err ' + err);
      console.log('results ' + results);
    });
  }
});

serial.on('open', function (data) {
  console.log('Serial opened: ' + data);
});
serial.on('error', function (data) {
  console.log('Serial error: ' + data);
});
serial.on('data', function (data) {
  console.log('Serial Data: ' + data);
});

console.log('Press <ctrl>+C to exit.')
