package main

import (
	"bitbucket.org/gmcbay/i2c"
	"fmt"
	"github.com/tarm/goserial"
	"io"
	"log"
	"os"
	"math/rand"
	"bytes"
	"time"
	"net/http"
	"net"
	"io/ioutil"
	"encoding/binary"
	"github.com/zefiro/wodo-raspi-light/colorcalculator"
)

var _ = os.Stdin
var _ = fmt.Println

// ----------------------------------------------------------------------------------------------------
type webserver struct {
	controller *Controller
}

func NewWebserver(controller *Controller) *webserver {
	webserver := &webserver{controller: controller}
	return webserver
}

func (this *webserver) viewHandler(w http.ResponseWriter, r *http.Request) {
    filename := "web/" + r.URL.Path[len("/web/"):]
    body, err := ioutil.ReadFile(filename)
    if err != nil {
        fmt.Fprintf(w, "Error loading file %s: %s", filename, err)
        return
    }
    fmt.Fprintf(w, "%s", body)
}

func (this *webserver) colorHandler(w http.ResponseWriter, r *http.Request) {
	res := make(chan string)
	this.controller.cmdChan <- Command{command: "next", result: res}
        result := <-res
	w.Header().Add("Cache-Control", "Cache-Control: no-cache, no-store, must-revalidate")
	w.Header().Add("Pragma", "no-cache")
	w.Header().Add("Expires", "0")
	fmt.Fprintf(w, "%s", result);
}

func (this *webserver) configHandler(w http.ResponseWriter, r *http.Request) {
	res := make(chan string)
	operation := r.URL.Path[len("/cfg/"):]
	result := "Parse Error"
	err := r.ParseForm()
	if err != nil {
		// TODO
	}
        if operation == "readconfig" {
		this.controller.cmdChan <- Command{command: "readconfig", result: res, httpRequest: r}
        	result = <-res
	} else if operation == "writeconfig" {
		this.controller.cmdChan <- Command{command: "writeconfig", result: res, httpRequest: r}
        	result = <-res
	} else if operation[:4] == "say/" {
		this.controller.cmdChan <- Command{command: operation[4:], result: res, httpRequest: r}
        	result = <-res
	}
	w.Header().Add("Cache-Control", "Cache-Control: no-cache, no-store, must-revalidate")
	w.Header().Add("Pragma", "no-cache")
	w.Header().Add("Expires", "0")
	fmt.Fprintf(w, "%s", result);
}


// ----------------------------------------------------------------------------------------------------
type ArtNetClient struct {
	controller *Controller
	addr *net.UDPAddr
	conn *net.UDPConn
}

func NewArtNetClient(controller *Controller) *ArtNetClient {
	this := &ArtNetClient{controller: controller}
	return this
}

func (this *ArtNetClient) initialize() {
	go this.run()
}

func (this *ArtNetClient) run() {
	a, err := net.ResolveUDPAddr("udp", ":6454")
	this.addr = a
	if err != nil {
		log.Panicf("FAIL ResolveUDPAddr: %v", err)
		return
	}
	this.conn, err = net.ListenUDP("udp", this.addr)
	if err != nil {
		log.Panicf("FAIL ListenUDP: %v", err)
		return
	}
	fmt.Printf("ArtNet Client started on %s\n", this.addr)
	for {
		buf := make([]byte, 1024)
		rlen, _, err := this.conn.ReadFromUDP(buf)
		if err != nil {
			fmt.Println(err)
		}
		if rlen > 8 && string(buf[:7]) == "Art-Net" && buf[7] == 0 {
			this.parseCommand(buf[8:], rlen)
		} else {
			fmt.Printf("Unrecognized UDP packet: '%s'\n", string(buf[0:rlen]))
		}
	}
}

func (this *ArtNetClient) parseCommand(buf []byte, rlen int) {
	opcode := (int16(buf[1]) << 8) + int16(buf[0])
	switch opcode {
	case 0x2000:
		protVerHigh := buf[2]
		protVerLow := buf[3]
		talkToMe := buf[4]
		diagLevel := buf[5]
		fmt.Printf("Opcode: 0x%4X, Protocol version %d.%d, talkToMe=%d, diagLevel=%d\n", opcode, protVerHigh, protVerLow, talkToMe, diagLevel)
		this.sendArtPollReply()
	default:
		fmt.Printf("Opcode: 0x%4X (unknown)\n", opcode)
	}
}

type artPollReplyPacket struct {
	ID [8]byte
	OpCode uint16
	IpAddress [4]byte
	Port uint16
	VersInfoH byte
	VersInfo byte
	NetSwitch byte
	SubSwitch byte
	OemHi byte
	Oem byte
	UbeaVersion byte
	Status1 byte
	EstaManLo byte
	EstaManHi byte
	ShortName [18]byte
	LongName [64]byte
	NodeReport [64]byte
	NumPortsHi byte
	NumPortsLo byte
	PortTypes [4]byte
	GoodInput [4]byte
	GoodOutput [4]byte
	SwIn byte
	SwOut byte
	SwVideo byte
	SwMacro byte
	SwRemote byte
	Spare [3]byte
	Style byte
	MAC [6]byte
	BindIp [4]byte
	BindIndex byte
	Status2 byte
	Filler [26]byte
}

func (this *ArtNetClient) sendArtPollReply() {
	fmt.Printf("Sending ArtPollReply\n");
	reply := &artPollReplyPacket{OpCode: 0x2100}
	copy(reply.ID[0:8], "Art-Net")
	reply.IpAddress[0] = 10
	reply.IpAddress[1] = 20
	reply.IpAddress[2] = 13
	reply.IpAddress[3] = 33
//	copy(reply.IpAddress[:], net.ParseIP("10.20.13.33"))
	copy(reply.ShortName[:], "Regalbrett")
	copy(reply.LongName[:], "World Domination - Regalbrett")
	reply.Port = 0x1936
	reply.NumPortsLo = 1
	reply.PortTypes[0] = 128
	reply.Style = 0
	reply.Status2 = 2 + 4 + 8
	broadcast, err := net.ResolveUDPAddr("udp", "255.255.255.255:6454")
	buf := new(bytes.Buffer)
	err = binary.Write(buf, binary.LittleEndian, reply)
	if err != nil {
		fmt.Printf("sendArtPollReply: binary.Write: %s\n", err)
	}
	_, err = this.conn.WriteToUDP(buf.Bytes(), broadcast)
	if err != nil {
		fmt.Printf("sendArtPollReply: conn.Write: %s\n", err)
	}
}

// ----------------------------------------------------------------------------------------------------

func outputColors(s io.ReadWriteCloser, leds colorcalculator.LedStrip) {
	outputNumLeds := 35
	s.Write([]byte("     \nbinary\n"))
	s.Write([]byte{'s', 0, byte(outputNumLeds - 1)})
	for i := 0; i < outputNumLeds; i++ {
		_, _ = s.Write([]byte{byte(leds[i].Red), byte(leds[i].Green), byte(leds[i].Blue)})
	}
}

// modprobe i2c-dev && modprobe i2c-bcm2708 baudrate=100000
// echo options i2c_bcm2708 baudrate=350000 > /etc/modprobe.d/i2c.conf

// I2C address is 7 bits + readwrite-bit
// linux wants the 7 bits = 0x10
// AVR wants the 8 bits = 0x20

func i2ctest() {
	var bus *i2c.I2CBus
	bus, err := i2c.Bus(0)
	if err != nil {
		log.Panicf("FAIL init bus %v", err)
		return
	}

	var t []byte
	copy(t[:], "?")
	err = bus.WriteByteBlock(0x10, 0x10, []byte{
		0x00, 0x80, 0x00,
		0x00, 0x80, 0x10,
		0x00, 0x80, 0x20,
		0x00, 0x80, 0x30,
		0x00, 0x80, 0x40,
		0x00, 0x80, 0x50,
		0x00, 0x80, 0x60,
		0x00, 0x80, 0x70,
		0x00, 0x80, 0x80,
		0x00, 0x80, 0x90,
	})
	if err != nil {
		log.Panicf("FAIL WriteByteBlock %v", err)
		return
	}

	//	b, err := bus.ReadByteBlock(0x10, 0x53, 100)
	//	if err != nil {
	//		log.Panicf("FAIL ReadByteBlock %v", err)
	//		return
	//	}
	//	fmt.Print(string(b))
}

func initI2c() (bus *i2c.I2CBus) {
	bus, err := i2c.Bus(0)
	if err != nil {
		log.Panicf("FAIL: initI2c: %v", err)
		return
	}
	return bus
}

/* Sends out the LedStrip colors in blocks of 20 RGB Leds as the AVR has 64 bytes input buffer */
// back to 30 bytes, as I'm getting "invalid argument" when I try to get higher (wtf?)
func outputColorsI2c(bus *i2c.I2CBus, leds colorcalculator.LedStrip) (error) {
	bytes := make([]byte, 3*10)
	idx := 0
	for ledidx, led := range leds {
		bytes[idx+0] = byte(led.Red)
		bytes[idx+1] = byte(led.Green)
		bytes[idx+2] = byte(led.Blue)
		idx += 3
		// send chunks of <64 bytes
		if idx == 3*10 {
		    register := byte(0x10+(ledidx/10));
			err := bus.WriteByteBlock(0x10, register, bytes)
			if err != nil {
				fmt.Printf("FAIL: outputColorsI2c: WriteByteBlock (ledidx=%d): %v\n\n", ledidx, err)
				return err
			}
            idx = 0
		}
	}
	// TODO if idx > 0 send remainder of colors from byte-slice
	err := bus.WriteByteBlock(0x10, 1, nil)
	if err != nil {
		fmt.Printf("FAIL: outputColorsI2c: WriteByteBlock (trigger): %v\n\n", err)
		return err
	}
	return nil
}

type Command struct {
	command string
	result chan string
	httpRequest *http.Request 
}

type Controller struct {
	leds colorcalculator.LedStrip
	fx colorcalculator.ColorCalculator
	cmdChan chan Command
	// commands for the main loop, if closed the program should exit
	MainLoopCmdChan chan string
	// outputs to I2c if != nil
	i2cbus *i2c.I2CBus
	// serial connection (for sending reset)
	serial io.ReadWriteCloser
}

func (this *Controller) CreateConfigForm() string {
	buffer := ""
	buffer += this.fx.WriteConfigHtml("cfg")
	return buffer
}

func (this *Controller) ParseConfigForm(request *http.Request) string {
	buffer := ""
	buffer += this.fx.ParseConfigHtml("cfg", request)
	return buffer
}

func (this *Controller) sendReset() {
	this.serial.Write([]byte("     \nreset\n"))
}

func (this *Controller) mainLoop() {
	t := time.After(time.Millisecond)
    var i int = 0
    var last int = 0
    var errCounter = 0
	for {
		select {
			case cmd, controllerOk := <- this.cmdChan:
				if !controllerOk {
					fmt.Println("Exiting controller")
					return
				}
				fmt.Printf("controller: got cmd '%s' (i=%d, diff=%d)\n", cmd.command, i, (i-last))
				last=i
				if cmd.command == "next" {
					cmd.result <- colorcalculator.ToJSON(this.leds)
				} else if cmd.command == "readconfig" {
					cmd.result <- this.CreateConfigForm()
				} else if cmd.command == "writeconfig" {
					cmd.result <- this.ParseConfigForm(cmd.httpRequest)
				} else if cmd.command[:4] == "say:" {
					cmd.result <- "Sent to main loop"
					this.MainLoopCmdChan <- cmd.command[4:]
				} else if cmd.command == "exit" {
					cmd.result <- "Exiting"
					time.Sleep(time.Second)
					close(this.MainLoopCmdChan)
				} else {
					cmd.result <- "Controller: Parse Error: cmd '" + cmd.command + "' unrecognized'"
				}
			case _ = <- t:
				t = time.After(1000 / colorcalculator.UpdateFrequency * time.Millisecond)
				this.leds = this.fx.CalculateColors(this.leds)
				if this.i2cbus != nil {
					err := outputColorsI2c(this.i2cbus, this.leds)
					if err != nil {
					    errCounter++
					    if errCounter > 3 && this.serial != nil {
					        fmt.Printf("Need to reset detected\n")
					        this.sendReset()
					        errCounter = 0
					    }
					} else {
					    errCounter = 0
					}
				}
				i++
		}
	}
}

func NewController() (this *Controller) {
	this = &Controller{}
	this.cmdChan = make(chan Command)
	this.MainLoopCmdChan = make(chan string)
	go this.mainLoop()
	return this
}

func main() {
	rand.Seed(time.Now().Unix())

	var useSerial bool = true
	var useI2C bool = true
	var waitForKey = false
	var com io.ReadWriteCloser = nil
    var err error

	if useSerial {
		config := &serial.Config{Name: "/dev/ttyAMA0", Baud: 38400}
		com, err = serial.OpenPort(config)
		if err != nil {
			log.Fatal(err)
		}
	}

	b := make([]byte,1)
	if waitForKey {
		fmt.Println("Ready - press key to continue")
		os.Stdin.Read(b)
	}

	controller := NewController()
	controller.serial = com


	fx := colorcalculator.NewSfxGroup()
	fx.AddSfx(colorcalculator.NewSfxLinear(5000, 50))
	fx.AddSfx(colorcalculator.NewSfxFire())
	fadeBlack := colorcalculator.NewSfxBlend()	
	fx.AddSfx(fadeBlack)
//	fx.AddSfx(NewSfxColor(RGB{50, 255, 0}))
//	fx.AddSfx(NewSfxGradient())
	//	fx = NewSfxMask(1000, fx)
	controller.fx = fx

	if useI2C {
		controller.i2cbus = initI2c()
	}

	fmt.Print("Starting HTTP server on port 8080...")
	webserver := NewWebserver(controller)
	http.HandleFunc("/web/", webserver.viewHandler)
	http.HandleFunc("/col/", webserver.colorHandler)
	http.HandleFunc("/cfg/", webserver.configHandler)
	go http.ListenAndServe(":8080", nil)
	fmt.Println(" started\n")

	dmx := NewArtNetClient(controller)
	dmx.initialize()

	fmt.Println("World Domination: Regalbrett READY - waiting for commands\n")

/*
	for {
		startTime := time.Now()
		t := time.After(1000 / updateFrequency * time.Millisecond)
		leds = fx.CalculateColors(leds)
		elapsedCalculate := time.Since(startTime) / time.Millisecond
		//		outputColors(s, leds)
		if useI2C {
			outputColorsI2c(bus, leds)
		}
		elapsedOutput := time.Since(startTime) / time.Millisecond
		<-t
		if false {
			fmt.Printf("%s (took %3d: %3d/%3d) -> RGB: %3d/%3d/%3d\n", fx.printState(), time.Since(startTime)/time.Millisecond, elapsedCalculate, elapsedOutput, leds[0].Red, leds[0].Green, leds[0].Blue)
		}
	}
*/

	// Main Loop
	for {
		cmd, opened := <-controller.MainLoopCmdChan
		if !opened {
			fmt.Println("Exiting main loop - Bye, Bye")
			return
		}
		fmt.Printf("Mainloop: got command: %s\n", cmd)
	}

}


